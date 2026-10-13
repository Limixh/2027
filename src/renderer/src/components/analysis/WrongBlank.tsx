import { Layers } from 'lucide-react'
import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardHeader, Dot } from '@/components/ui'
import type { SubjectMistakeStat } from './derive'
import { AXIS_TICK, TipBox } from './parts'

const WRONG = '#ef4444'
const BLANK = '#64748b'

export function WrongBlank({ stats }: { stats: SubjectMistakeStat[] }): React.JSX.Element {
  const data = useMemo(
    () =>
      stats
        .filter((s) => s.total > 0)
        .map((s) => ({
          name: s.subject.short,
          full: s.subject.name,
          wrong: Math.round((s.wrong / s.total) * 1000) / 10,
          blank: Math.round((s.blank / s.total) * 1000) / 10,
          wrongN: s.wrong,
          blankN: s.blank,
          total: s.total
        }))
        .sort((a, b) => b.wrong + b.blank - (a.wrong + a.blank)),
    [stats]
  )

  return (
    <Card className="flex flex-col">
      <CardHeader
        icon={<Layers size={16} />}
        title="Yanlış ve boş oranı"
        subtitle="Çözülen soruların yüzdesi olarak"
        action={
          <div className="flex items-center gap-3 text-[11px] text-muted">
            <span className="flex items-center gap-1.5">
              <Dot color={WRONG} /> Yanlış
            </span>
            <span className="flex items-center gap-1.5">
              <Dot color={BLANK} /> Boş
            </span>
          </div>
        }
      />
      <div className="px-3 pb-4 pt-2">
        {data.length === 0 ? (
          <p className="py-16 text-center text-xs text-muted">Skor verisi yok.</p>
        ) : (
          <div style={{ height: Math.max(220, data.length * 28 + 30) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 0 }} barCategoryGap={6}>
                <CartesianGrid horizontal={false} stroke="rgb(var(--border))" strokeDasharray="3 3" />
                <XAxis type="number" tick={AXIS_TICK} tickFormatter={(v) => `%${v}`} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={AXIS_TICK} width={48} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgb(var(--surface-2) / 0.6)' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const p = payload[0].payload as (typeof data)[number]
                    return (
                      <TipBox title={p.full}>
                        <div className="tabular">
                          Yanlış: {p.wrongN} (%{p.wrong})
                        </div>
                        <div className="tabular">
                          Boş: {p.blankN} (%{p.blank})
                        </div>
                        <div className="tabular">Toplam soru: {p.total}</div>
                      </TipBox>
                    )
                  }}
                />
                <Bar dataKey="wrong" stackId="a" fill={WRONG} fillOpacity={0.85} animationDuration={400} />
                <Bar dataKey="blank" stackId="a" fill={BLANK} fillOpacity={0.7} radius={[0, 4, 4, 0]} animationDuration={400} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </Card>
  )
}
