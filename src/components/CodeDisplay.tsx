interface CodeDisplayProps {
  code: string
}

export default function CodeDisplay({ code }: CodeDisplayProps) {
  const digits = code.split('')

  return (
    <div className="flex gap-2.5 justify-center">
      {digits.map((digit, i) => (
        <div key={i} className="relative">
          <div
            className="
              w-12 h-14 rounded-xl
              bg-white/[0.06] backdrop-blur-xl
              border border-white/[0.08]
              flex items-center justify-center
              text-2xl font-semibold tracking-wide
              text-text-primary
              animate-slide-up
            "
            style={{ animationDelay: `${i * 60}ms` }}
          >
            {digit}
          </div>
          {i === 2 && (
            <div className="absolute -right-[9px] top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-text-tertiary" />
          )}
        </div>
      ))}
    </div>
  )
}
