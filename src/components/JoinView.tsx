import { useState } from 'react'
import GlassPanel from './GlassPanel'
import CodeInput from './CodeInput'

interface JoinViewProps {
  onSubmit: (code: string) => void
  onCancel: () => void
}

export default function JoinView({ onSubmit, onCancel }: JoinViewProps) {
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState('')

  const handleComplete = async (code: string) => {
    setConnecting(true)
    setError('')
    onSubmit(code)
    setTimeout(() => {
      setConnecting(false)
    }, 12000)
  }

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
              <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
          </div>

          <h2 className="text-lg font-semibold mb-1.5 text-text-primary">Enter code</h2>
          <p className="text-text-secondary text-sm mb-6">
            Enter the 6-digit code shown on the other device
          </p>

          {/* Code input */}
          <div className="mb-6">
            <CodeInput onComplete={handleComplete} />
          </div>

          {/* Status */}
          {connecting && (
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              <span className="text-sm text-text-secondary">Searching network...</span>
            </div>
          )}

          {error && (
            <div className="mb-4">
              <span className="text-sm text-danger">{error}</span>
            </div>
          )}

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
