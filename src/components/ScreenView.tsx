import { useRef, useEffect, useCallback } from 'react'
import { InputEvent } from '../types'

interface ScreenViewProps {
  stream: MediaStream
  isControlling: boolean
  onInputEvent: (event: InputEvent) => void
}

export default function ScreenView({ stream, isControlling, onInputEvent }: ScreenViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  const getNormalizedCoords = useCallback(
    (e: React.MouseEvent): { x: number; y: number } => {
      if (!videoRef.current) return { x: 0, y: 0 }

      const video = videoRef.current
      const rect = video.getBoundingClientRect()

      // Account for object-fit: contain — the video might not fill the entire element
      const videoAspect = video.videoWidth / video.videoHeight
      const elementAspect = rect.width / rect.height

      let renderWidth: number, renderHeight: number
      let offsetX = 0, offsetY = 0

      if (videoAspect > elementAspect) {
        // Video is wider — letterboxed top/bottom
        renderWidth = rect.width
        renderHeight = rect.width / videoAspect
        offsetY = (rect.height - renderHeight) / 2
      } else {
        // Video is taller — pillarboxed left/right
        renderHeight = rect.height
        renderWidth = rect.height * videoAspect
        offsetX = (rect.width - renderWidth) / 2
      }

      const x = (e.clientX - rect.left - offsetX) / renderWidth
      const y = (e.clientY - rect.top - offsetY) / renderHeight

      return {
        x: Math.max(0, Math.min(1, x)),
        y: Math.max(0, Math.min(1, y)),
      }
    },
    []
  )

  const getButtonName = (button: number): 'left' | 'right' | 'middle' => {
    if (button === 2) return 'right'
    if (button === 1) return 'middle'
    return 'left'
  }

  const getModifiers = (e: React.MouseEvent | React.KeyboardEvent) => ({
    ctrl: e.ctrlKey,
    alt: e.altKey,
    shift: e.shiftKey,
    meta: e.metaKey,
  })

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isControlling) return
      const { x, y } = getNormalizedCoords(e)
      onInputEvent({ type: 'mouse-move', x, y })
    },
    [isControlling, getNormalizedCoords, onInputEvent]
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isControlling) return
      e.preventDefault()
      const { x, y } = getNormalizedCoords(e)
      onInputEvent({
        type: 'mouse-down',
        x,
        y,
        button: getButtonName(e.button),
        modifiers: getModifiers(e),
      })
    },
    [isControlling, getNormalizedCoords, onInputEvent]
  )

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (!isControlling) return
      const { x, y } = getNormalizedCoords(e)
      onInputEvent({
        type: 'mouse-up',
        x,
        y,
        button: getButtonName(e.button),
        modifiers: getModifiers(e),
      })
    },
    [isControlling, getNormalizedCoords, onInputEvent]
  )

  const handleScroll = useCallback(
    (e: React.WheelEvent) => {
      if (!isControlling) return
      e.preventDefault()
      onInputEvent({
        type: 'mouse-scroll',
        deltaX: e.deltaX,
        deltaY: e.deltaY,
      })
    },
    [isControlling, onInputEvent]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isControlling) return
      e.preventDefault()
      onInputEvent({
        type: 'key-down',
        key: e.key,
        code: e.code,
        modifiers: getModifiers(e),
      })
    },
    [isControlling, onInputEvent]
  )

  const handleKeyUp = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isControlling) return
      e.preventDefault()
      onInputEvent({
        type: 'key-up',
        key: e.key,
        code: e.code,
        modifiers: getModifiers(e),
      })
    },
    [isControlling, onInputEvent]
  )

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (isControlling) e.preventDefault()
  }, [isControlling])

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black"
      tabIndex={0}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onWheel={handleScroll}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onContextMenu={handleContextMenu}
      style={{ cursor: isControlling ? 'none' : 'default' }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-contain"
        style={{ willChange: 'contents' }}
        disablePictureInPicture
      />

      {/* Control mode indicator */}
      {isControlling && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-accent/20 border border-accent/30 text-accent text-xs font-medium backdrop-blur-xl">
          Remote control active
        </div>
      )}
    </div>
  )
}
