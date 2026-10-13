import { ArrowDownRight, ArrowUpRight, Minus, Activity } from 'lucide-react'
import { useMemo } from 'react'
import { Line, LineChart, ResponsiveContainer, Tooltip, YAxis } from 'recharts'
import { Badge, Card, CardHeader } from '@/components/ui'
import { SUBJECT_MAP, SUBJECTS } from '@/data/curriculum'
import { formatShort } from '@/lib/date'
import { examSeries } from '@/lib/stats'
import { fmtNet } from '@/lib/exam'
import type { ExamResult, ExamType } from '../../../../shared/types'
import { TipBox } from './parts'

interface Item {
  id: string
  name: string
  color: string
  exam: ExamType
  points: { date: string; name: string; v: number }[]
}

const order = (id: string): number => SUBJECTS.findIndex((s) => s.id === id)

export function TrendGrid({ exams, types }: { exams: ExamResult[]; types: ExamType[] }): React.JSX.Element {
  const items = useMemo<Item[]>(() => {
    const out: Item[] = []
    for (const t of types) {
      const series = examSeries(exams, t)
      const ids = new Set<string>()
      for (const row of series) for (const k of Object.keys(row)) if (SUBJECT_MAP[k]) ids.add(k)
      for (const id of ids) {
        const s = SUBJECT_MAP[id]
        const points = series
          .filter((r) => typeof r[id] === 'number')
          .slice(-10)
          .map((r) => ({ date: String(r.date), name: String(r.name), v: r[id] as number }))
        out.push({ id, name: s.name, color: s.color, exam: t, points })
      }
    }
    return out.sort((a, b) => a.exam.localeCompare(b.exam) || order(a.id) - order(b.id))
  }, [exams, types])

  return (
    <Card>
      <CardHeader icon={<Activity size={16} />} title="Ders bazında net trendi" subtitle="Son 10 deneme" />
      {items.length === 0 ? (
        <p className="px-5 py-12 text-center text-xs text-muted">Trend için deneme verisi yok.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 px-4 pb-4 pt-3 md:grid-cols-3">
          {items.map((it) => {
            const last = it.points[it.points.length - 1]?.v ?? 0
            const prev = it.points.length > 1 ? it.points[it.points.length - 2].v : last
            const d = Math.round((last - prev) * 100) / 100
            const up = d > 0.05
            const down = d < -0.05
            return (
              <div key={it.id} className="rounded-xl border border-border/70 bg-surface-2/40 p-3 transition hover:bg-surface-2">
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate text-xs font-medium text-muted">{it.name}</span>
                  {types.length > 1 && <Badge>{it.exam}</Badge>}
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="tabular text-lg font-semibold text-text">{fmtNet(last)}</span>
                  <span
                    className={`tabular inline-flex items-center text-[11px] font-semibold ${
                      up ? 'text-success' : down ? 'text-danger' : 'text-subtle'
                    }`}
                  >
                    {up ? <ArrowUpRight size={12} /> : down ? <ArrowDownRight size={12} /> : <Minus size={12} />}
                    {d > 0 ? '+' : ''}
                    {fmtNet(d)}
                  </span>
                </div>
                <div className="mt-1 h-10">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={it.points} margin={{ top: 4, bottom: 4, left: 4, right: 4 }}>
                      <YAxis hide domain={['dataMin - 1', 'dataMax + 1']} />
                      <Tooltip
                        cursor={false}
                        isAnimationActive={false}
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null
                          const p = payload[0].payload as Item['points'][number]
                          return (
                            <TipBox title={p.name}>
                              <div className="tabular">
                                {formatShort(p.date)} · {fmtNet(p.v)} net
                              </div>
                            </TipBox>
                          )
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="v"
                        stroke={it.color}
                        strokeWidth={2}
                        dot={it.points.length < 3 ? { r: 3, fill: it.color } : false}
                        activeDot={{ r: 3.5 }}
                        animationDuration={400}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
