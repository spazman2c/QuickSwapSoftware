interface HomeScreenProps {
  onHost: () => void
  onJoin: () => void
  onNetworkTest: () => void
}

export default function HomeScreen({ onHost, onJoin, onNetworkTest }: HomeScreenProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 pb-8 animate-fade-in">
      {/* Logo */}
      <div className="mb-10 text-center">
        <div className="relative inline-block mb-3">
          <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-accent"
            >
              <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" />
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <path d="M12 8l4 4-4 4" />
              <path d="M8 12h8" />
            </svg>
          </div>
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-text-primary">QuickSwap</h1>
        <p className="text-text-tertiary text-xs mt-1">
          LAN screen sharing
        </p>
      </div>

      {/* Action buttons */}
      <div className="w-full max-w-[240px] space-y-2.5">
        <button
          onClick={onHost}
          className="
            titlebar-no-drag w-full
            flex items-center gap-3 px-4 py-3
            rounded-xl
            bg-accent hover:bg-accent-hover
            text-white text-sm font-medium
            transition-all duration-150
            active:scale-[0.98]
          "
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <path d="M8 21h8" />
            <path d="M12 17v4" />
          </svg>
          Share Screen
        </button>

        <button
          onClick={onJoin}
          className="
            titlebar-no-drag w-full
            flex items-center gap-3 px-4 py-3
            rounded-xl
            bg-white/[0.06] border border-white/[0.06]
            text-text-primary text-sm font-medium
            hover:bg-white/[0.1] hover:border-white/[0.1]
            transition-all duration-150
            active:scale-[0.98]
          "
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" />
            <polyline points="10 17 15 12 10 7" />
            <line x1="15" y1="12" x2="3" y2="12" />
          </svg>
          Connect
        </button>

        <button
          onClick={onNetworkTest}
          className="
            titlebar-no-drag w-full
            flex items-center gap-3 px-4 py-2.5
            rounded-xl
            text-text-tertiary text-xs
            hover:text-text-secondary hover:bg-white/[0.04]
            transition-all duration-150
          "
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
          Network Test
        </button>
      </div>

      {/* Version */}
      <div className="mt-auto pt-6">
        <p className="text-text-tertiary text-[10px]">v1.2.0</p>
      </div>
    </div>
  )
}
