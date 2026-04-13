import { useState, useEffect } from 'react'

export default function TitleBar() {
  const [isMac, setIsMac] = useState(true)

  useEffect(() => {
    window.quickswap.getPlatform().then((p: string) => {
      setIsMac(p === 'darwin')
    })
  }, [])

  return (
    <div className="titlebar-drag h-12 flex items-center shrink-0 relative">
      {/* macOS traffic lights get their own space via trafficLightPosition */}
      {isMac && <div className="w-20" />}

      {/* Windows title bar buttons */}
      {!isMac && (
        <div className="titlebar-no-drag absolute right-0 top-0 flex h-full">
          <button
            onClick={() => window.quickswap.minimizeWindow()}
            className="h-full w-12 flex items-center justify-center hover:bg-white/10 transition-colors"
          >
            <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor">
              <rect width="10" height="1" />
            </svg>
          </button>
          <button
            onClick={() => window.quickswap.closeWindow()}
            className="h-full w-12 flex items-center justify-center hover:bg-[#e81123] transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
              <path d="M1 0L0 1l4 4-4 4 1 1 4-4 4 4 1-1-4-4 4-4-1-1-4 4z" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
