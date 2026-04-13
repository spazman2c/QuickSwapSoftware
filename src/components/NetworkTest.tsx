import { useState, useEffect, useRef, useCallback } from 'react'
import GlassPanel from './GlassPanel'

interface NetworkTestProps {
  onBack: () => void
}

interface TestResults {
  captureFps: number
  encodeFps: number
  resolution: string
  bitrate: number
  codec: string
  latency: number
  status: 'idle' | 'running' | 'done'
  elapsed: number
}

export default function NetworkTest({ onBack }: NetworkTestProps) {
  const [results, setResults] = useState<TestResults>({
    captureFps: 0,
    encodeFps: 0,
    resolution: '--',
    bitrate: 0,
    codec: '--',
    latency: 0,
    status: 'idle',
    elapsed: 0,
  })

  const pcSenderRef = useRef<RTCPeerConnection | null>(null)
  const pcReceiverRef = useRef<RTCPeerConnection | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const cleanedUpRef = useRef(false)

  const cleanup = useCallback(() => {
    if (cleanedUpRef.current) return
    cleanedUpRef.current = true
    streamRef.current?.getTracks().forEach((t) => t.stop())
    pcSenderRef.current?.close()
    pcReceiverRef.current?.close()
    streamRef.current = null
    pcSenderRef.current = null
    pcReceiverRef.current = null
  }, [])

  useEffect(() => {
    return cleanup
  }, [cleanup])

  const runTest = useCallback(async () => {
    cleanedUpRef.current = false
    setResults((r) => ({ ...r, status: 'running', elapsed: 0 }))

    try {
      // Capture screen
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: 60, max: 60 },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      })
      streamRef.current = stream

      const videoTrack = stream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.contentHint = 'motion'
      }

      const settings = videoTrack.getSettings()
      setResults((r) => ({
        ...r,
        resolution: `${settings.width}x${settings.height}`,
      }))

      // Create loopback WebRTC connection
      const sender = new RTCPeerConnection({ iceServers: [] })
      const receiver = new RTCPeerConnection({ iceServers: [] })
      pcSenderRef.current = sender
      pcReceiverRef.current = receiver

      sender.onicecandidate = (e) => {
        if (e.candidate) receiver.addIceCandidate(e.candidate)
      }
      receiver.onicecandidate = (e) => {
        if (e.candidate) sender.addIceCandidate(e.candidate)
      }

      stream.getTracks().forEach((track) => {
        sender.addTrack(track, stream)
      })

      // Prefer H.264
      const transceivers = sender.getTransceivers()
      const videoTransceiver = transceivers.find(
        (t) => t.sender.track?.kind === 'video'
      )
      if (videoTransceiver) {
        const codecs = RTCRtpReceiver.getCapabilities('video')?.codecs || []
        const h264 = codecs.filter((c) => c.mimeType === 'video/H264')
        const others = codecs.filter((c) => c.mimeType !== 'video/H264')
        if (h264.length > 0) {
          videoTransceiver.setCodecPreferences([...h264, ...others])
        }
      }

      // Track received frames via hidden video element
      let receiveFrameCount = 0
      const receiverVideo = document.createElement('video')
      receiverVideo.muted = true
      receiverVideo.autoplay = true
      receiverVideo.style.cssText = 'position:absolute;opacity:0;pointer-events:none;width:1px;height:1px'
      document.body.appendChild(receiverVideo)

      receiver.ontrack = (event) => {
        receiverVideo.srcObject = event.streams[0]
        receiverVideo.play().catch(() => {})

        if ('requestVideoFrameCallback' in receiverVideo) {
          const countFrame = () => {
            receiveFrameCount++
            ;(receiverVideo as any).requestVideoFrameCallback(countFrame)
          }
          ;(receiverVideo as any).requestVideoFrameCallback(countFrame)
        }
      }

      // Negotiate
      const offer = await sender.createOffer()
      await sender.setLocalDescription(offer)

      const senderObj = sender.getSenders().find((s) => s.track?.kind === 'video')
      if (senderObj) {
        const params = senderObj.getParameters()
        if (!params.encodings || params.encodings.length === 0) {
          params.encodings = [{}]
        }
        params.encodings[0].maxFramerate = 60
        params.encodings[0].maxBitrate = 50_000_000
        params.degradationPreference = 'maintain-framerate'
        await senderObj.setParameters(params)
      }

      await receiver.setRemoteDescription(offer)
      const answer = await receiver.createAnswer()
      await receiver.setLocalDescription(answer)
      await sender.setRemoteDescription(answer)

      // Measure for 5 seconds
      const testDuration = 5
      let secondsElapsed = 0
      let lastReceiveCount = 0
      let lastBytesSent = 0

      // Detect codec from stats
      const detectCodec = async () => {
        const stats = await sender.getStats()
        stats.forEach((report: any) => {
          if (report.type === 'outbound-rtp' && report.kind === 'video') {
            const codecId = report.codecId
            if (codecId) {
              stats.forEach((codecReport: any) => {
                if (codecReport.id === codecId && codecReport.mimeType) {
                  setResults((r) => ({
                    ...r,
                    codec: codecReport.mimeType.replace('video/', ''),
                  }))
                }
              })
            }
          }
        })
      }

      const interval = setInterval(async () => {
        secondsElapsed++

        // Get sender stats
        const stats = await sender.getStats()
        let bytesSent = 0
        let framesEncoded = 0
        let framesPerSecond = 0

        stats.forEach((report: any) => {
          if (report.type === 'outbound-rtp' && report.kind === 'video') {
            bytesSent = report.bytesSent || 0
            framesEncoded = report.framesEncoded || 0
            framesPerSecond = report.framesPerSecond || 0
          }
        })

        // Calculate bitrate from delta
        const bitrate = Math.round(((bytesSent - lastBytesSent) * 8) / 1_000_000)
        lastBytesSent = bytesSent

        // Receive FPS from frame callback counter
        const receiveFps = receiveFrameCount - lastReceiveCount
        lastReceiveCount = receiveFrameCount

        // Round-trip latency estimate from receiver stats
        let latency = 0
        const recvStats = await receiver.getStats()
        recvStats.forEach((report: any) => {
          if (report.type === 'inbound-rtp' && report.kind === 'video') {
            if (report.jitterBufferDelay && report.jitterBufferEmittedCount) {
              latency = Math.round(
                (report.jitterBufferDelay / report.jitterBufferEmittedCount) * 1000
              )
            }
          }
        })

        setResults((r) => ({
          ...r,
          encodeFps: framesPerSecond || framesEncoded,
          captureFps: receiveFps > 0 ? receiveFps : r.captureFps,
          bitrate: bitrate > 0 ? bitrate : r.bitrate,
          latency,
          elapsed: secondsElapsed,
        }))

        if (secondsElapsed >= 1) {
          detectCodec()
        }

        if (secondsElapsed >= testDuration) {
          clearInterval(interval)
          receiverVideo.remove()
          cleanup()
          setResults((r) => ({ ...r, status: 'done' }))
        }
      }, 1000)
    } catch (err) {
      console.error('Network test failed:', err)
      cleanup()
      setResults((r) => ({ ...r, status: 'idle' }))
    }
  }, [cleanup])

  const rating =
    results.captureFps >= 55
      ? { label: 'Excellent', color: 'text-success', bg: 'bg-success' }
      : results.captureFps >= 40
        ? { label: 'Good', color: 'text-success', bg: 'bg-success' }
        : results.captureFps >= 25
          ? { label: 'Fair', color: 'text-warning', bg: 'bg-warning' }
          : { label: 'Poor', color: 'text-danger', bg: 'bg-danger' }

  return (
    <div className="flex-1 flex flex-col items-center px-8 pb-8 pt-4 animate-fade-in">
      {/* Header */}
      <div className="w-full max-w-xs mb-6">
        <button
          onClick={() => { cleanup(); onBack() }}
          className="flex items-center gap-1.5 text-text-secondary hover:text-text-primary transition-colors text-sm mb-4"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>
        <h2 className="text-xl font-semibold text-text-primary">Network Test</h2>
        <p className="text-text-secondary text-sm mt-1">
          Test your screen capture and encoding performance
        </p>
      </div>

      {/* Results */}
      <div className="w-full max-w-xs space-y-3">
        {results.status === 'idle' && (
          <button
            onClick={runTest}
            className="w-full py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium text-[15px] transition-colors"
          >
            Run Test
          </button>
        )}

        {results.status === 'running' && (
          <GlassPanel padding="md">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <span className="text-text-secondary text-sm">
                Testing... {results.elapsed}/5s
              </span>
            </div>
          </GlassPanel>
        )}

        {(results.status === 'running' || results.status === 'done') && (
          <>
            {/* Overall Rating */}
            {results.status === 'done' && (
              <GlassPanel padding="md">
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary text-sm">Overall</span>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${rating.bg}`} />
                    <span className={`font-semibold text-[15px] ${rating.color}`}>
                      {rating.label}
                    </span>
                  </div>
                </div>
              </GlassPanel>
            )}

            {/* Stats Grid */}
            <GlassPanel padding="md">
              <div className="space-y-4">
                <StatRow
                  label="Capture FPS"
                  value={results.captureFps > 0 ? `${results.captureFps}` : '--'}
                  detail="Frames received per second"
                  color={results.captureFps >= 55 ? 'text-success' : results.captureFps >= 30 ? 'text-warning' : results.captureFps > 0 ? 'text-danger' : 'text-text-tertiary'}
                />
                <StatRow
                  label="Encode FPS"
                  value={results.encodeFps > 0 ? `${results.encodeFps}` : '--'}
                  detail="Frames encoded by WebRTC"
                  color={results.encodeFps >= 55 ? 'text-success' : results.encodeFps >= 30 ? 'text-warning' : results.encodeFps > 0 ? 'text-danger' : 'text-text-tertiary'}
                />
                <StatRow
                  label="Resolution"
                  value={results.resolution}
                  detail="Capture resolution"
                  color="text-text-primary"
                />
                <StatRow
                  label="Bitrate"
                  value={results.bitrate > 0 ? `${results.bitrate} Mbps` : '--'}
                  detail="Video stream throughput"
                  color="text-text-primary"
                />
                <StatRow
                  label="Codec"
                  value={results.codec}
                  detail={results.codec === 'H264' ? 'Hardware accelerated' : results.codec === '--' ? '' : 'Software encoding'}
                  color={results.codec === 'H264' ? 'text-success' : 'text-text-primary'}
                />
                <StatRow
                  label="Buffer Latency"
                  value={results.latency > 0 ? `${results.latency} ms` : '--'}
                  detail="Jitter buffer delay"
                  color={results.latency > 0 && results.latency < 50 ? 'text-success' : results.latency >= 50 ? 'text-warning' : 'text-text-tertiary'}
                />
              </div>
            </GlassPanel>

            {results.status === 'done' && (
              <button
                onClick={() => {
                  cleanedUpRef.current = false
                  setResults({
                    captureFps: 0, encodeFps: 0, resolution: '--',
                    bitrate: 0, codec: '--', latency: 0,
                    status: 'idle', elapsed: 0,
                  })
                }}
                className="w-full py-3 rounded-xl bg-surface-raised hover:bg-surface-raised/80 border border-white/[0.06] text-text-primary font-medium text-[15px] transition-colors"
              >
                Run Again
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function StatRow({
  label,
  value,
  detail,
  color,
}: {
  label: string
  value: string
  detail: string
  color: string
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-sm text-text-secondary">{label}</div>
        {detail && <div className="text-[11px] text-text-tertiary mt-0.5">{detail}</div>}
      </div>
      <span className={`font-semibold text-[15px] tabular-nums ${color}`}>{value}</span>
    </div>
  )
}
