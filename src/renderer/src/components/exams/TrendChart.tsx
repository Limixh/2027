import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ExamResult, ExamType } from '../../../../shared/types'
import { Card, CardHeader, Dot, cn } from '@/components/ui'
import { SUBJECTS } from '@/data/curriculum'
import { formatDate, formatShort } from '@/lib/date'
import { fmtNet } from '@/lib/exam'
import { examSeries } from '@/lib/stats'
import { TrendingUp } from 'lucide-react'

const tickStyle = { fill: 'rgb(var(--subtle))', fontSize: 11 }

export default function TrendChart({
  exams,
  type,
  target
}: {
  exams: ExamResult[]
  type: ExamType
  target: number
}): React.JSX.Element {
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [extra, setExtra] = useState<Set<string>>(new Set())

  const series = useMemo(() => examSeries(exams, type), [exams, type])
  const presentSubjects = useMemo(
    () => SUBJECTS.filter((s) => s.exam === type && series.some((r) => typeof r[s.id] === 'number')),
    [series, type]
  )
  const byId = useMemo(() => new Map(series.map((r) => [String(r.id), r])), [series])

  const showTotal = !hidden.has('total')
  const activeSubjects = presentSubjects.filter((s) => extra.has(s.id))

  const domain = useMemo<[number, number]>(() => {
    const vals: number[] = []
    if (showTotal) {
      for (const r of series) vals.push(Number(r.total))
      if (target > 0) vals.push(target)
    }
    for (const s of activeSubjects) for (const r of series) if (typeof r[s.id] === 'number') vals.push(Number(r[s.id]))
    if (!vals.length) return [0, 10]
    const lo = Math.min(...vals)
    const hi = Math.max(...vals)
    const pad = Math.max(2, (hi - lo) * 0.12)
    const span = hi - lo + 2 * pad
    const step = span > 60 ? 20 : span > 28 ? 10 : 5
    const floor = Math.floor((lo - pad) / step) * step
    return [lo < 0 ? floor : Math.max(0, floor), Math.ceil((hi + pad) / step) * step]
  }, [series, showTotal, activeSubjects, target])

  const toggleExtra = (id: string): void =>
    setExtra((p) => {
      const n = new Set(p)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  return (
    <Card className="pb-4">
      <CardHeader
        icon={<TrendingUp size={16} />}
        title={`${type} net gelişimi`}
        subtitle={target > 0 ? `Hedef: ${fmtNet(target)} net` : 'Deneme sonuçlarına göre toplam net'}
        action={
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() =>
                setHidden((p) => {
                  const n = new Set(p)
                  if (n.has('total')) n.delete('total')
                  else n.add('total')
                  return n
                })
              }
              className={cn(
                'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors',
                showTotal ? 'border-accent/40 bg-accent/10 text-text' : 'border-border text-subtle hover:text-text'
              )}
            >
              <Dot color="rgb(var(--accent))" /> Toplam
            </button>
            {presentSubjects.map((s) => {
              const on = extra.has(s.id)
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleExtra(s.id)}
                  className={cn(
                    'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors',
                    on ? 'text-text' : 'border-border text-subtle hover:text-text'
                  )}
                  style={on ? { borderColor: s.color + '66', background: s.color + '1a' } : undefined}
                >
                  <Dot color={s.color} /> {s.short}
                </button>
              )
            })}
          </div>
        }
      />
      <div className="mt-3 h-[280px] px-3">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 10, right: 16, left: -12, bottom: 0 }}>
            <CartesianGrid stroke="rgb(var(--border))" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="id"
              tick={tickStyle}
              tickLine={false}
              axisLine={{ stroke: 'rgb(var(--border))' }}
              tickFormatter={(id) => formatShort(String(byId.get(String(id))?.date ?? ''))}
              interval="preserveStartEnd"
              minTickGap={24}
              padding={{ left: 16, right: 16 }}
            />
            <YAxis domain={domain} tick={tickStyle} tickLine={false} axisLine={false} width={44} allowDecimals={false} />
            <Tooltip
              cursor={{ stroke: 'rgb(var(--border))' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const row = payload[0].payload as Record<string, number | string>
                return (
                  <div className="card min-w-[170px] px-3 py-2 text-xs shadow-lg">
                    <div className="font-semibold">{String(row.name)}</div>
                    <div className="mb-1.5 text-[11px] text-subtle">{formatDate(String(row.date))}</div>
                    {payload.map((p) => (
                      <div key={String(p.dataKey)} className="flex items-center justify-between gap-4 text-muted">
                        <span className="inline-flex items-center gap-1.5">
                          <Dot color={String(p.color)} size={7} />
                          {p.dataKey === 'total' ? 'Toplam' : SUBJECTS.find((s) => s.id === p.dataKey)?.short}
                        </span>
                        <b className="tabular text-text">{fmtNet(Number(p.value))}</b>
                      </div>
                    ))}
                  </div>
                )
              }}
            />
            {showTotal && target > 0 && (
              <ReferenceLine
                y={target}
                stroke="rgb(var(--success))"
                strokeDasharray="5 4"
                ifOverflow="extendDomain"
                label={{ value: `Hedef ${fmtNet(target)}`, position: 'insideTopRight', fill: 'rgb(var(--success))', fontSize: 11 }}
              />
            )}
            {activeSubjects.map((s) => (
              <Line
                key={s.id}
                type="monotone"
                dataKey={s.id}
                stroke={s.color}
                strokeWidth={1.75}
                dot={{ r: 2.5, fill: s.color, strokeWidth: 0 }}
                connectNulls
                animationDuration={300}
              />
            ))}
            {showTotal && (
              <Line
                type="monotone"
                dataKey="total"
                stroke="rgb(var(--accent))"
                strokeWidth={2.75}
                dot={{ r: 4, fill: 'rgb(var(--surface))', stroke: 'rgb(var(--accent))', strokeWidth: 2 }}
                activeDot={{ r: 5.5 }}
                animationDuration={400}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
