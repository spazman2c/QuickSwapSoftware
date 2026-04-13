import { useState, useEffect } from 'react'

interface ConnectionOverlayProps {
  pc: RTCPeerConnection | null
  fps: number
}

export default function ConnectionOverlay({ pc, fps }: ConnectionOverlayProps) {
  const [latency, setLatency] = useState(0)
  const [resolution, setResolution] = useState('')
  const [bitrate, setBitrate] = useState(0)
  const [codec, setCodec] = useState('')

  useEffect(() => {
    if (!pc) return

    let prevBytes = 0

    const interval = setInterval(async () => {
      try {
        const stats = await pc.getStats()

        stats.forEach((report: any) => {
          // Inbound (receiving side)
          if (report.type === 'inbound-rtp' && report.kind === 'video') {
            if (report.frameWidth && report.frameHeight) {
              setResolution(`${report.frameWidth}x${report.frameHeight}`)
            }
            if (report.bytesReceived != null) {
              const delta = report.bytesReceived - prevBytes
              prevBytes = report.bytesReceived
              if (delta > 0) setBitrate(Math.round((delta * 8) / 1_000_000))
            }
            if (report.codecId) {
              stats.forEach((cr: any) => {
                if (cr.id === report.codecId && cr.mimeType) {
                  setCodec(cr.mimeType.replace('video/', ''))
                }
              })
            }
          }

          // Outbound (sending side)
          if (report.type === 'outbound-rtp' && report.kind === 'video') {
            if (report.frameWidth && report.frameHeight) {
              setResolution(`${report.frameWidth}x${report.frameHeight}`)
            }
            if (report.bytesSent != null) {
              const delta = report.bytesSent - prevBytes
              prevBytes = report.bytesSent
              if (delta > 0) setBitrate(Math.round((delta * 8) / 1_000_000))
            }
            if (report.codecId) {
              stats.forEach((cr: any) => {
                if (cr.id === report.codecId && cr.mimeType) {
                  setCodec(cr.mimeType.replace('video/', ''))
                }
              })
            }
          }

          // RTT from ICE
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
  }, [pc])

  const fpsColor = fps >= 55 ? 'text-success' : fps >= 30 ? 'text-warning' : 'text-danger'
  const latencyColor = latency > 0 && latency < 20 ? 'text-success' : latency < 50 ? 'text-warning' : 'text-danger'

  return (
    <div className="absolute top-3 right-3 z-10 pointer-events-none">
      <div className="bg-black/50 backdrop-blur-sm rounded-lg px-2.5 py-1.5 border border-white/[0.06] text-[10px] font-mono tabular-nums leading-relaxed">
        <div className="flex items-center justify-between gap-3">
          <span className="text-text-tertiary">FPS</span>
          <span className={fpsColor}>{fps}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-text-tertiary">RTT</span>
          <span className={latencyColor}>{latency > 0 ? `${latency}ms` : '--'}</span>
        </div>
        {resolution && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-text-tertiary">Res</span>
            <span className="text-text-secondary">{resolution}</span>
          </div>
        )}
        {bitrate > 0 && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-text-tertiary">Mbps</span>
            <span className="text-text-secondary">{bitrate}</span>
          </div>
        )}
        {codec && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-text-tertiary">Enc</span>
            <span className={codec === 'H264' ? 'text-success' : 'text-text-secondary'}>{codec}</span>
          </div>
        )}
      </div>
    </div>
  )
}
