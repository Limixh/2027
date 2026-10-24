import { STATUS_COLOR, type SkillStatus } from '@/lib/brain'

/** Güç geçmişi: 40 ve 70 eşikleri soluk çizgilerle gösterilir */
export function Sparkline({
  points,
  status,
  width = 148,
  height = 40
}: {
  points: number[]
  status: SkillStatus
  width?: number
  height?: number
}): React.JSX.Element {
  const color = STATUS_COLOR[status]
  const pad = 4
  const x = (i: number): number => pad + (points.length <= 1 ? (width - pad * 2) / 2 : (i * (width - pad * 2)) / (points.length - 1))
  const y = (v: number): number => pad + (1 - v / 100) * (height - pad * 2)
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(' ')
  const last = points[points.length - 1] ?? 50
  return (
    <svg width={width} height={height} role="img" aria-label="Güç geçmişi" className="overflow-visible">
      {[40, 70].map((t) => (
        <line key={t} x1={0} x2={width} y1={y(t)} y2={y(t)} stroke="rgb(var(--border))" strokeDasharray="2 4" />
      ))}
      <path d={d} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" opacity={0.9} />
      <circle cx={x(points.length - 1)} cy={y(last)} r={3} fill={color} />
    </svg>
  )
}
