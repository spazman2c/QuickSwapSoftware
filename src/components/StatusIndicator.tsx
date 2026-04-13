interface StatusIndicatorProps {
  fps: number
}

export default function StatusIndicator({ fps }: StatusIndicatorProps) {
  const fpsColor = fps >= 55 ? 'text-success' : fps >= 30 ? 'text-warning' : 'text-danger'
  const dotColor = fps >= 55 ? 'bg-success' : fps >= 30 ? 'bg-warning' : 'bg-danger'

  return (
    <div className="flex items-center gap-1.5 text-xs font-medium">
      <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      <span className={fpsColor}>{fps} FPS</span>
    </div>
  )
}
