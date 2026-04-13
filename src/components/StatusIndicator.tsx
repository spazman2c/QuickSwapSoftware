import { useState, useEffect, useRef } from 'react'

interface StatusIndicatorProps {
  stream: MediaStream | null
}

export default function StatusIndicator({ stream }: StatusIndicatorProps) {
  const [fps, setFps] = useState(0)
  const [resolution, setResolution] = useState('')
  const frameCountRef = useRef(0)

  useEffect(() => {
    if (!stream) return

    const videoTrack = stream.getVideoTracks()[0]
    if (!videoTrack) return

    // Update resolution from track settings
    const updateSettings = () => {
      const settings = videoTrack.getSettings()
      if (settings.width && settings.height) {
        setResolution(`${settings.width}x${settings.height}`)
      }
    }
    updateSettings()

    // FPS counter using requestVideoFrameCallback or fallback
    let rafId: number
    let lastTime = performance.now()

    // Try to use a hidden video element for frame counting
    const video = document.createElement('video')
    video.srcObject = stream
    video.muted = true
    video.style.position = 'absolute'
    video.style.opacity = '0'
    video.style.pointerEvents = 'none'
    video.style.width = '1px'
    video.style.height = '1px'
    document.body.appendChild(video)
    video.play().catch(() => {})

    if ('requestVideoFrameCallback' in video) {
      const countFrame = () => {
        frameCountRef.current++
        ;(video as any).requestVideoFrameCallback(countFrame)
      }
      ;(video as any).requestVideoFrameCallback(countFrame)
    } else {
      // Fallback: estimate from requestAnimationFrame
      const tick = () => {
        frameCountRef.current++
        rafId = requestAnimationFrame(tick)
      }
      rafId = requestAnimationFrame(tick)
    }

    const interval = setInterval(() => {
      const now = performance.now()
      const elapsed = (now - lastTime) / 1000
      const currentFps = Math.round(frameCountRef.current / elapsed)
      setFps(currentFps)
      frameCountRef.current = 0
      lastTime = now
      updateSettings()
    }, 1000)

    return () => {
      clearInterval(interval)
      cancelAnimationFrame(rafId)
      video.remove()
    }
  }, [stream])

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
