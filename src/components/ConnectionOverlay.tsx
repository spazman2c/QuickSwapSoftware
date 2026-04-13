import { useState, useEffect, useRef } from 'react'

interface ConnectionOverlayProps {
  pc: RTCPeerConnection | null
  stream: MediaStream | null
}

export default function ConnectionOverlay({ pc, stream }: ConnectionOverlayProps) {
  const [fps, setFps] = useState(0)
  const [latency, setLatency] = useState(0)
  const [resolution, setResolution] = useState('')
  const [bitrate, setBitrate] = useState(0)
  const [codec, setCodec] = useState('')
  const prevBytesRef = useRef(0)
  const prevFramesRef = useRef(0)

  useEffect(() => {
    if (!pc) return

    const videoTrack = stream?.getVideoTracks()[0]

    const interval = setInterval(async () => {
      if (videoTrack) {
        const settings = videoTrack.getSettings()
        if (settings.width && settings.height) {
          setResolution(`${settings.width}x${settings.height}`)
        }
      }

      try {
        const stats = await pc.getStats()
        let gotFps = false

        stats.forEach((report: any) => {
          // Inbound (receiving)
          if (report.type === 'inbound-rtp' && report.kind === 'video') {
            if (report.framesPerSecond != null) {
              setFps(Math.round(report.framesPerSecond))
              gotFps = true
            } else if (report.framesDecoded != null && !gotFps) {
              const delta = report.framesDecoded - prevFramesRef.current
              prevFramesRef.current = report.framesDecoded
              if (delta > 0) setFps(delta)
              gotFps = true
            }

            if (report.bytesReceived != null) {
              const bytesDelta = report.bytesReceived - prevBytesRef.current
              prevBytesRef.current = report.bytesReceived
              if (bytesDelta > 0) {
                setBitrate(Math.round((bytesDelta * 8) / 1_000_000))
              }
            }

            // Resolution from the RTP report (what we're actually receiving)
            if (report.frameWidth && report.frameHeight) {
              setResolution(`${report.frameWidth}x${report.frameHeight}`)
            }
          }

          // Outbound (sending)
          if (report.type === 'outbound-rtp' && report.kind === 'video') {
            if (!gotFps && report.framesPerSecond != null) {
              setFps(Math.round(report.framesPerSecond))
            }

            if (report.bytesSent != null) {
              const bytesDelta = report.bytesSent - prevBytesRef.current
              prevBytesRef.current = report.bytesSent
              if (bytesDelta > 0) {
                setBitrate(Math.round((bytesDelta * 8) / 1_000_000))
              }
            }

            // Detect codec
            const codecId = report.codecId
            if (codecId) {
              stats.forEach((codecReport: any) => {
                if (codecReport.id === codecId && codecReport.mimeType) {
                  setCodec(codecReport.mimeType.replace('video/', ''))
                }
              })
            }
          }

          // Inbound codec detection
          if (report.type === 'inbound-rtp' && report.kind === 'video' && report.codecId) {
            stats.forEach((codecReport: any) => {
              if (codecReport.id === report.codecId && codecReport.mimeType) {
                setCodec(codecReport.mimeType.replace('video/', ''))
              }
            })
          }

          // RTT from ICE candidate pair
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            if (report.currentRoundTripTime != null) {
              setLatency(Math.round(report.currentRoundTripTime * 1000))
            }
          }
        })
      } catch {
        // Stats not available yet
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [pc, stream])

  const fpsColor = fps >= 55 ? 'text-success' : fps >= 30 ? 'text-warning' : 'text-danger'
  const latencyColor = latency > 0 && latency < 20 ? 'text-success' : latency < 50 ? 'text-warning' : 'text-danger'

  return (
    <div className="absolute top-3 right-3 z-10 pointer-events-none">
      <div className="bg-black/60 backdrop-blur-md rounded-lg px-3 py-2 border border-white/[0.08] text-[11px] font-mono tabular-nums space-y-0.5">
        <div className="flex items-center justify-between gap-4">
          <span className="text-text-tertiary">FPS</span>
          <span className={fpsColor}>{fps}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-text-tertiary">Latency</span>
          <span className={latencyColor}>{latency > 0 ? `${latency} ms` : '--'}</span>
        </div>
        {resolution && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-text-tertiary">Res</span>
            <span className="text-text-secondary">{resolution}</span>
          </div>
        )}
        {bitrate > 0 && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-text-tertiary">Bitrate</span>
            <span className="text-text-secondary">{bitrate} Mbps</span>
          </div>
        )}
        {codec && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-text-tertiary">Codec</span>
            <span className={codec === 'H264' ? 'text-success' : 'text-text-secondary'}>{codec}</span>
          </div>
        )}
      </div>
    </div>
  )
}
