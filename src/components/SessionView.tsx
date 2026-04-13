import { useState, useCallback } from 'react'
import { SessionRole, InputEvent } from '../types'
import ScreenView from './ScreenView'
import ControlBar from './ControlBar'
import ConnectionOverlay from './ConnectionOverlay'

interface SessionViewProps {
  stream: MediaStream
  pc: RTCPeerConnection | null
  role: SessionRole
  peerName: string
  isControlling: boolean
  gameMode: boolean
  onDisconnect: () => void
  onSwap: () => void
  onRequestControl: () => void
  onToggleGameMode: () => void
  onInputEvent: (event: InputEvent) => void
}

export default function SessionView({
  stream,
  pc,
  role,
  peerName,
  isControlling,
  gameMode,
  onDisconnect,
  onSwap,
  onRequestControl,
  onToggleGameMode,
  onInputEvent,
}: SessionViewProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [fps, setFps] = useState(0)

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
        onFpsUpdate={setFps}
      />
      <ConnectionOverlay pc={pc} fps={fps} />
      <ControlBar
        stream={stream}
        pc={pc}
        peerName={peerName}
        isControlling={isControlling}
        gameMode={gameMode}
        fps={fps}
        onDisconnect={onDisconnect}
        onSwap={onSwap}
        onRequestControl={onRequestControl}
        onToggleFullscreen={toggleFullscreen}
        onToggleGameMode={onToggleGameMode}
        isFullscreen={isFullscreen}
      />
    </div>
  )
}
