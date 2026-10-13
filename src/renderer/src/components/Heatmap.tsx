// GitHub tarzı Activity Heatmap — günlük çalışma süresini renk yoğunluğuyla gösterir.
import { useEffect, useMemo, useRef, useState } from 'react'
import { addDays, diffDays, formatDate, formatMinutes, fromKey, MONTHS_SHORT, startOfWeek, todayKey, weekdayName } from '@/lib/date'
import { cn } from './ui'

const LEVEL_ALPHA = [0, 0.28, 0.5, 0.75, 1]

/** Hedefe göre seviye: 0 yok, 1 <%25, 2 <%60, 3 <%100, 4 hedef tamam */
export function heatLevel(minutes: number, goal: number): number {
  if (minutes <= 0) return 0
  const r = minutes / Math.max(goal, 1)
  if (r < 0.25) return 1
  if (r < 0.6) return 2
  if (r < 1) return 3
  return 4
}

export function heatColor(level: number): string {
  if (level === 0) return 'rgb(var(--heat-0))'
  return `rgb(var(--accent) / ${LEVEL_ALPHA[level]})`
}

interface Props {
  /** tarih -> dakika */
  data: Map<string, number>
  /** Günlük hedef (dk) — renk seviyeleri buna göre */
  goal: number
  /** Başlangıç (dahil). Varsayılan: bugünden 52 hafta önce */
  from?: string
  /** Bitiş (dahil). Varsayılan: bugün */
  to?: string
  /** Vurgulanacak gün (ör. sınav günü) */
  markDate?: string
  onSelect?: (date: string) => void
  selected?: string
  className?: string
  showLegend?: boolean
}

export function Heatmap({
  data,
  goal,
  from,
  to,
  markDate,
  onSelect,
  selected,
  className,
  showLegend = true
}: Props): React.JSX.Element {
  const today = todayKey()
  const end = to ?? today
  const start = startOfWeek(from ?? addDays(end, -7 * 52))
  const weeks = Math.ceil((diffDays(start, end) + 1) / 7)

  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(800)
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const labelW = 28
  const gap = 3
  const cell = Math.max(9, Math.min(18, Math.floor((width - labelW) / weeks) - gap))
  const step = cell + gap

  const columns = useMemo(() => {
    const cols: { date: string; minutes: number; future: boolean; inRange: boolean }[][] = []
    for (let w = 0; w < weeks; w++) {
      const col = []
      for (let d = 0; d < 7; d++) {
        const date = addDays(start, w * 7 + d)
        col.push({
          date,
          minutes: data.get(date) ?? 0,
          future: date > today,
          inRange: date >= (from ?? start) && date <= end
        })
      }
      cols.push(col)
    }
    return cols
  }, [weeks, start, data, today, from, end])

  const monthLabels = useMemo(() => {
    const out: { x: number; label: string }[] = []
    let lastMonth = -1
    columns.forEach((col, i) => {
      const firstOfMonth = col.find((c) => fromKey(c.date).getDate() <= 7)
      const m = fromKey(col[0].date).getMonth()
      if (firstOfMonth && m !== lastMonth) {
        const fm = fromKey(firstOfMonth.date).getMonth()
        if (fm !== lastMonth) {
          out.push({ x: i * step, label: MONTHS_SHORT[fm] })
          lastMonth = fm
        }
      }
    })
    return out
  }, [columns, step])

  const [hover, setHover] = useState<{ date: string; minutes: number; x: number; y: number } | null>(null)
  const svgW = labelW + weeks * step
  const svgH = 18 + 7 * step

  return (
    <div ref={wrapRef} className={cn('relative w-full', className)}>
      <div className="overflow-x-auto">
        <svg width={svgW} height={svgH} className="block select-none">
          {monthLabels.map((m) => (
            <text key={m.x} x={labelW + m.x} y={11} className="fill-subtle text-[10px]">
              {m.label}
            </text>
          ))}
          {['Pzt', '', 'Çar', '', 'Cum', '', 'Paz'].map((d, i) =>
            d ? (
              <text key={i} x={0} y={18 + i * step + cell - 1} className="fill-subtle text-[10px]">
                {d}
              </text>
            ) : null
          )}
          {columns.map((col, w) =>
            col.map((c, d) => {
              if (!c.inRange) return null
              const lvl = heatLevel(c.minutes, goal)
              const isToday = c.date === today
              const isMark = c.date === markDate
              const isSel = c.date === selected
              return (
                <rect
                  key={c.date}
                  x={labelW + w * step}
                  y={18 + d * step}
                  width={cell}
                  height={cell}
                  rx={Math.max(2, cell / 4.5)}
                  fill={c.future ? 'transparent' : heatColor(lvl)}
                  stroke={
                    isSel
                      ? 'rgb(var(--text))'
                      : isMark
                        ? 'rgb(var(--danger))'
                        : isToday
                          ? 'rgb(var(--accent))'
                          : c.future
                            ? 'rgb(var(--border))'
                            : 'transparent'
                  }
                  strokeWidth={isSel || isMark || isToday ? 1.5 : 1}
                  strokeDasharray={c.future && !isMark ? '2 2' : undefined}
                  className={cn('transition-opacity', onSelect && !c.future && 'cursor-pointer hover:opacity-80')}
                  onMouseEnter={(e) => {
                    const box = wrapRef.current!.getBoundingClientRect()
                    const r = (e.target as SVGRectElement).getBoundingClientRect()
                    setHover({ date: c.date, minutes: c.minutes, x: r.left - box.left + cell / 2, y: r.top - box.top })
                  }}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => !c.future && onSelect?.(c.date)}
                />
              )
            })
          )}
        </svg>
      </div>

      {hover && (
        <div
          className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs shadow-card"
          style={{ left: hover.x, top: hover.y - 6 }}
        >
          <div className="font-semibold text-text">
            {hover.minutes > 0 ? formatMinutes(hover.minutes) : hover.date > today ? 'Gelecek gün' : 'Çalışma yok'}
            {hover.date === markDate && ' · Sınav günü'}
          </div>
          <div className="text-muted">
            {formatDate(hover.date)}, {weekdayName(hover.date)}
          </div>
        </div>
      )}

      {showLegend && (
        <div className="mt-2 flex items-center justify-end gap-1.5 text-[11px] text-subtle">
          <span>Az</span>
          {[0, 1, 2, 3, 4].map((l) => (
            <span key={l} className="inline-block h-[11px] w-[11px] rounded-[3px]" style={{ background: heatColor(l) }} />
          ))}
          <span>Hedef ✓</span>
        </div>
      )}
    </div>
  )
}
