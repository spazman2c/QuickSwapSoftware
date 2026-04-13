import GlassPanel from './GlassPanel'
import CodeDisplay from './CodeDisplay'

interface HostViewProps {
  code: string
  peerConnected: boolean
  onCancel: () => void
}

export default function HostView({ code, peerConnected, onCancel }: HostViewProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 pb-8 animate-fade-in">
      <div className="w-full max-w-xs">
        <GlassPanel padding="lg" className="text-center">
          {/* Icon */}
          <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-5">
            <svg
              width="24"
              height="24"
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

          <h2 className="text-lg font-semibold mb-1.5 text-text-primary">Share your screen</h2>
          <p className="text-text-secondary text-sm mb-6">
            Share this code with the person you want to connect with
          </p>

          {/* Code display */}
          <div className="mb-6">
            <CodeDisplay code={code} />
          </div>

          {/* Status */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {peerConnected ? (
              <>
                <div className="w-2 h-2 rounded-full bg-success" />
                <span className="text-sm text-success">Connected — starting stream...</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 rounded-full bg-warning animate-pulse" />
                <span className="text-sm text-text-secondary">Waiting for connection...</span>
              </>
            )}
          </div>

          {/* Cancel */}
          <button
            onClick={onCancel}
            className="
              titlebar-no-drag
              w-full py-2.5 rounded-xl
              bg-white/[0.06] border border-white/[0.08]
              text-text-secondary text-sm font-medium
              hover:bg-white/[0.1] hover:text-text-primary
              transition-all duration-200
              active:scale-[0.98]
            "
          >
            Cancel
          </button>
        </GlassPanel>
      </div>
    </div>
  )
}
