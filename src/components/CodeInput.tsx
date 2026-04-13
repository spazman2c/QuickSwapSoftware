import { useState, useRef, useEffect, KeyboardEvent } from 'react'

interface CodeInputProps {
  onComplete: (code: string) => void
}

export default function CodeInput({ onComplete }: CodeInputProps) {
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return

    const newDigits = [...digits]

    if (value.length > 1) {
      const pasted = value.slice(0, 6 - index).split('')
      pasted.forEach((d, i) => {
        if (index + i < 6) newDigits[index + i] = d
      })
      setDigits(newDigits)

      const nextIndex = Math.min(index + pasted.length, 5)
      inputRefs.current[nextIndex]?.focus()

      if (newDigits.every((d) => d !== '')) {
        onComplete(newDigits.join(''))
      }
      return
    }

    newDigits[index] = value
    setDigits(newDigits)

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    if (newDigits.every((d) => d !== '')) {
      onComplete(newDigits.join(''))
    }
  }

  const handleKeyDown = (index: number, e: KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      const newDigits = [...digits]
      newDigits[index - 1] = ''
      setDigits(newDigits)
      inputRefs.current[index - 1]?.focus()
    }
  }

  return (
    <div className="flex gap-2.5 justify-center">
      {digits.map((digit, i) => (
        <div key={i} className="relative">
          <input
            ref={(el) => { inputRefs.current[i] = el }}
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={digit}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            className="
              titlebar-no-drag
              w-12 h-14 rounded-xl
              bg-white/[0.06]
              border border-white/[0.08]
              text-center text-2xl font-semibold tracking-wide
              text-text-primary
              focus:border-accent/60 focus:ring-1 focus:ring-accent/20 focus:bg-white/[0.08]
              transition-all duration-200
              outline-none
              animate-slide-up
              placeholder:text-text-tertiary
            "
            style={{ animationDelay: `${i * 60}ms` }}
          />
          {i === 2 && (
            <div className="absolute -right-[9px] top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-text-tertiary" />
          )}
        </div>
      ))}
    </div>
  )
}
