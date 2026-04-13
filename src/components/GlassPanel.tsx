import { ReactNode } from 'react'

interface GlassPanelProps {
  children: ReactNode
  className?: string
  hover?: boolean
  padding?: 'sm' | 'md' | 'lg'
  onClick?: () => void
}

export default function GlassPanel({
  children,
  className = '',
  hover = false,
  padding = 'md',
  onClick,
}: GlassPanelProps) {
  const paddingMap = {
    sm: 'p-3',
    md: 'p-5',
    lg: 'p-8',
  }

  return (
    <div
      onClick={onClick}
      className={`
        bg-surface-raised/60 backdrop-blur-xl
        border border-white/[0.06]
        rounded-2xl
        ${paddingMap[padding]}
        ${hover ? 'cursor-pointer transition-all duration-200 hover:bg-surface-raised/80 hover:border-white/[0.1] active:scale-[0.98]' : ''}
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  )
}
