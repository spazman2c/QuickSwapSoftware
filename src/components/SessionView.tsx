import { useState, useCallback } from 'react'
import { SessionRole, InputEvent } from '../types'
import ScreenView from './ScreenView'
import ControlBar from './ControlBar'

interface SessionViewProps {
  stream: MediaStream
  role: SessionRole
  peerName: string
  isControlling: boolean
  onDisconnect: () => void
  onSwap: () => void
  onRequestControl: () => void
  onInputEvent: (event: InputEvent) => void
}

export default function SessionView({
  stream,
  role,
  peerName,
  isControlling,
  onDisconnect,
  onSwap,
  onRequestControl,
  onInputEvent,
}: SessionViewProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }, [])

  return (
    <div className="h-full w-full relative bg-black">
      <ScreenView
        stream={stream}
        isControlling={isControlling}
        onInputEvent={onInputEvent}
      />
      <ControlBar
        stream={stream}
        peerName={peerName}
        isControlling={isControlling}
        onDisconnect={onDisconnect}
        onSwap={onSwap}
        onRequestControl={onRequestControl}
        onToggleFullscreen={toggleFullscreen}
        isFullscreen={isFullscreen}
      />
    </div>
  )
}
