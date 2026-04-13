import GlassPanel from './GlassPanel'

interface HomeScreenProps {
  onHost: () => void
  onJoin: () => void
}

export default function HomeScreen({ onHost, onJoin }: HomeScreenProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 pb-8 animate-fade-in">
      {/* Logo */}
      <div className="mb-10 text-center">
        <div className="relative inline-block mb-4">
          <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center shadow-lg shadow-accent/10">
            <svg
              width="32"
              height="32"
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
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary">QuickSwap</h1>
        <p className="text-text-secondary text-sm mt-1.5">
          Fast screen sharing for your local network
        </p>
      </div>

      {/* Action buttons */}
      <div className="w-full max-w-xs space-y-3">
        <GlassPanel hover padding="md" onClick={onHost}>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-accent"
              >
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8" />
                <path d="M12 17v4" />
              </svg>
            </div>
            <div>
              <div className="font-medium text-[15px] text-text-primary">Share Screen</div>
              <div className="text-text-secondary text-xs mt-0.5">
                Generate a code for others to connect
              </div>
            </div>
          </div>
        </GlassPanel>

        <GlassPanel hover padding="md" onClick={onJoin}>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-accent"
              >
                <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
            </div>
            <div>
              <div className="font-medium text-[15px] text-text-primary">Connect</div>
              <div className="text-text-secondary text-xs mt-0.5">
                Enter a code to view a shared screen
              </div>
            </div>
          </div>
        </GlassPanel>
      </div>

      {/* Version */}
      <div className="mt-auto pt-6">
        <p className="text-text-tertiary text-xs">v1.0.0</p>
      </div>
    </div>
  )
}
