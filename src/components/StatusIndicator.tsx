import { useState, useEffect, useRef } from 'react'

interface StatusIndicatorProps {
  stream: MediaStream | null
  pc: RTCPeerConnection | null
}

export default function StatusIndicator({ stream, pc }: StatusIndicatorProps) {
  const [fps, setFps] = useState(0)
  const [resolution, setResolution] = useState('')
  const [latency, setLatency] = useState(0)
  const prevFramesRef = useRef(0)

  useEffect(() => {
    if (!stream && !pc) return

    const videoTrack = stream?.getVideoTracks()[0]

    const interval = setInterval(async () => {
      // Get resolution from track settings
      if (videoTrack) {
        const settings = videoTrack.getSettings()
        if (settings.width && settings.height) {
          setResolution(`${settings.width}x${settings.height}`)
        }
      }

      // Get FPS and latency from WebRTC stats (much more accurate than frame counting)
      if (pc) {
        try {
          const stats = await pc.getStats()
          stats.forEach((report: any) => {
            // Inbound video — we're receiving
            if (report.type === 'inbound-rtp' && report.kind === 'video') {
              // Use framesPerSecond if available (Chrome provides this)
              if (report.framesPerSecond != null) {
                setFps(Math.round(report.framesPerSecond))
              } else if (report.framesDecoded != null) {
                // Fallback: calculate from frames decoded delta
                const delta = report.framesDecoded - prevFramesRef.current
                prevFramesRef.current = report.framesDecoded
                if (delta > 0) setFps(delta)
              }

              // Jitter buffer latency
              if (report.jitterBufferDelay && report.jitterBufferEmittedCount) {
                const jitterMs = Math.round(
                  (report.jitterBufferDelay / report.jitterBufferEmittedCount) * 1000
                )
                setLatency(jitterMs)
              }
            }

            // Outbound video — we're sending
            if (report.type === 'outbound-rtp' && report.kind === 'video') {
              if (report.framesPerSecond != null) {
                setFps(Math.round(report.framesPerSecond))
              } else if (report.framesEncoded != null) {
                const delta = report.framesEncoded - prevFramesRef.current
                prevFramesRef.current = report.framesEncoded
                if (delta > 0) setFps(delta)
              }
            }

            // Round-trip time from ICE candidate pair
            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
              if (report.currentRoundTripTime != null) {
                setLatency(Math.round(report.currentRoundTripTime * 1000))
              }
            }
          })
        } catch {
          // Stats not available yet
        }
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [stream, pc])

  const fpsColor = fps >= 55 ? 'text-success' : fps >= 30 ? 'text-warning' : 'text-danger'

  return (
    <div className="flex items-center gap-3 text-xs font-medium">
      <div className="flex items-center gap-1.5">
        <div className={`w-1.5 h-1.5 rounded-full ${fps >= 55 ? 'bg-success' : fps >= 30 ? 'bg-warning' : 'bg-danger'}`} />
        <span className={fpsColor}>{fps} FPS</span>
      </div>
      {resolution && (
        <span className="text-text-tertiary">{resolution}</span>
      )}
    </div>
  )
}
