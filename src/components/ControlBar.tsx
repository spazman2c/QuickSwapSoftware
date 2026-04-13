import { useState, useEffect, useRef } from 'react'
import StatusIndicator from './StatusIndicator'

interface ControlBarProps {
  stream: MediaStream | null
  pc: RTCPeerConnection | null
  peerName: string
  isControlling: boolean
  gameMode: boolean
  fps: number
  onDisconnect: () => void
  onSwap: () => void
  onRequestControl: () => void
  onToggleFullscreen: () => void
  onToggleGameMode: () => void
  isFullscreen: boolean
}

export default function ControlBar({
  peerName,
  isControlling,
  gameMode,
  fps,
  onDisconnect,
  onSwap,
  onRequestControl,
  onToggleFullscreen,
  onToggleGameMode,
  isFullscreen,
}: ControlBarProps) {
  const [visible, setVisible] = useState(true)
  const [pinned, setPinned] = useState(false)
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (pinned) return

    const resetTimer = () => {
      setVisible(true)
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = setTimeout(() => setVisible(false), 3000)
    }

    resetTimer()
    window.addEventListener('mousemove', resetTimer)
    return () => {
      window.removeEventListener('mousemove', resetTimer)
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
    }
  }, [pinned])

  const iconBtn = (active: boolean) => `
    titlebar-no-drag p-1.5 rounded-lg transition-all duration-150
    ${active
      ? 'bg-accent/15 text-accent border border-accent/25'
      : 'bg-white/[0.06] border border-white/[0.06] text-text-secondary hover:text-text-primary hover:bg-white/[0.1]'
    }
  `

  return (
    <div
      className={`
        absolute bottom-4 left-1/2 -translate-x-1/2
        bg-[#1C1C1E]/90 backdrop-blur-2xl
        border border-white/[0.06]
        rounded-2xl
        px-3 py-2
        flex items-center gap-2
        transition-all duration-300
        shadow-lg shadow-black/40
        ${visible || pinned ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}
      `}
      onMouseEnter={() => {
        setVisible(true)
        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
      }}
      onMouseLeave={() => {
        if (!pinned) {
          hideTimeoutRef.current = setTimeout(() => setVisible(false), 2000)
        }
      }}
    >
      <StatusIndicator fps={fps} />

      <div className="w-px h-4 bg-white/[0.06]" />

      <span className="text-[11px] text-text-secondary max-w-[100px] truncate">
        {peerName}
      </span>

      <div className="w-px h-4 bg-white/[0.06]" />

      {/* Control */}
      <button
        onClick={isControlling ? undefined : onRequestControl}
        className={`
          titlebar-no-drag
          px-2.5 py-1 rounded-lg text-[11px] font-medium
          transition-all duration-150
          ${isControlling
            ? 'bg-accent/15 text-accent border border-accent/25'
            : 'bg-white/[0.06] border border-white/[0.06] text-text-secondary hover:text-text-primary hover:bg-white/[0.1]'
          }
        `}
        title={isControlling ? 'Currently controlling' : 'Request control'}
      >
        {isControlling ? 'Controlling' : 'Control'}
      </button>

      {/* Game Mode */}
      <button
        onClick={onToggleGameMode}
        className={iconBtn(gameMode)}
        title={gameMode ? 'Game mode on' : 'Game mode'}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 12h4m-2-2v4" />
          <circle cx="17" cy="10" r="1" fill="currentColor" />
          <circle cx="15" cy="14" r="1" fill="currentColor" />
          <rect x="2" y="6" width="20" height="12" rx="3" />
        </svg>
      </button>

      {/* Swap */}
      <button onClick={onSwap} className={iconBtn(false)} title="Swap screens">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 16V4m0 0L3 8m4-4l4 4" />
          <path d="M17 8v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      </button>

      {/* Pin */}
      <button onClick={() => setPinned(!pinned)} className={iconBtn(pinned)} title={pinned ? 'Unpin' : 'Pin'}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 17v5" />
          <path d="M5 17h14v-1.76a2 2 0 00-1.11-1.79l-1.78-.9A2 2 0 0115 10.76V6h1a2 2 0 000-4H8a2 2 0 000 4h1v4.76a2 2 0 01-1.11 1.79l-1.78.9A2 2 0 005 15.24z" />
        </svg>
      </button>

      {/* Fullscreen */}
      <button onClick={onToggleFullscreen} className={iconBtn(false)} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
        {isFullscreen ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3v3a2 2 0 01-2 2H3" />
            <path d="M21 8h-3a2 2 0 01-2-2V3" />
            <path d="M3 16h3a2 2 0 012 2v3" />
            <path d="M16 21v-3a2 2 0 012-2h3" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3H5a2 2 0 00-2 2v3" />
            <path d="M21 8V5a2 2 0 00-2-2h-3" />
            <path d="M3 16v3a2 2 0 002 2h3" />
            <path d="M16 21h3a2 2 0 002-2v-3" />
          </svg>
        )}
      </button>

      <div className="w-px h-4 bg-white/[0.06]" />

      {/* Disconnect */}
      <button
        onClick={onDisconnect}
        className="
          titlebar-no-drag
          px-2.5 py-1 rounded-lg text-[11px] font-medium
          bg-danger/10 border border-danger/20
          text-danger hover:bg-danger/20
          transition-all duration-150
        "
      >
        End
      </button>
    </div>
  )
}
