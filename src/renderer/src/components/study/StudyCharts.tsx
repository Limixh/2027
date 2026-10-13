import { BarChart3, CalendarDays, PieChart as PieIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { StudySession } from '../../../../shared/types'
import { Card, CardHeader, Dot, EmptyState, Segmented } from '@/components/ui'
import { addDays, DAYS, DAYS_SHORT, formatDate, formatMinutes, fromKey, todayKey, weekdayName } from '@/lib/date'
import { OTHER_COLOR, subjectColor, subjectShortFull, subjectFullName } from './meta'

const tick = { fill: 'rgb(var(--subtle))', fontSize: 11 }

const hoursTick = (v: number): string => (v === 0 ? '0' : v >= 60 ? `${(v / 60).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} sa` : `${v} dk`)

/** Dakika ekseni için yuvarlak (30/60/120...) tikler */
function minuteTicks(max: number): number[] {
  const steps = [15, 30, 60, 120, 180, 240, 360]
  const step = steps.find((st) => Math.ceil(max / st) <= 5) ?? 360
  const top = Math.max(1, Math.ceil(max / step)) * step
  return Array.from({ length: top / step + 1 }, (_, i) => i * step)
}

function TipBox({ title, children }: { title: React.ReactNode; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-card">
      <div className="mb-1 font-semibold text-text">{title}</div>
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Günlük dakika grafiği (derse göre yığılmış)                         */
/* ------------------------------------------------------------------ */

export function DailyBars({ sessions, goal }: { sessions: StudySession[]; goal: number }): React.JSX.Element {
  const [range, setRange] = useState<'14' | '30'>('14')
  const n = Number(range)

  const { rows, keys, max, any } = useMemo(() => {
    const today = todayKey()
    const from = addDays(today, -(n - 1))
    const keysSet = new Set<string>()
    const rowMap = new Map<string, Record<string, number | string>>()
    for (let i = 0; i < n; i++) {
      const date = addDays(from, i)
      rowMap.set(date, { date, total: 0 })
    }
    for (const s of sessions) {
      const row = rowMap.get(s.date)
      if (!row) continue
      const k = s.subjectId ?? 'diger'
      keysSet.add(k)
      row[k] = ((row[k] as number) ?? 0) + s.minutes
      row.total = (row.total as number) + s.minutes
    }
    const rows = [...rowMap.values()]
    const max = Math.max(0, ...rows.map((r) => r.total as number))
    return { rows, keys: [...keysSet], max, any: max > 0 }
  }, [sessions, n])

  const showGoal = goal > 0 && goal <= Math.max(max, 1) * 3
  const ticks = minuteTicks(Math.max(max, showGoal ? goal : 0))

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        icon={<BarChart3 size={16} />}
        title="Günlük çalışma süresi"
        subtitle="Derse göre renklendirilmiş"
        action={
          <Segmented
            size="sm"
            value={range}
            onChange={setRange}
            options={[
              { value: '14', label: '14 gün' },
              { value: '30', label: '30 gün' }
            ]}
          />
        }
      />
      <div className="min-h-[240px] flex-1 px-3 pb-4 pt-3">
        {!any ? (
          <EmptyState icon={<BarChart3 size={20} />} title="Bu aralıkta çalışma yok" description="Çalışma ekledikçe günlük süreler burada sütunlar olarak görünecek." />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="rgb(var(--border))" strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={tick}
                tickLine={false}
                axisLine={false}
                interval={n === 14 ? 0 : 3}
                tickFormatter={(d: string) => (n === 14 ? DAYS_SHORT[(fromKey(d).getDay() + 6) % 7] : String(fromKey(d).getDate()))}
              />
              <YAxis
                tick={tick}
                tickLine={false}
                axisLine={false}
                width={44}
                tickFormatter={hoursTick}
                ticks={ticks}
                domain={[0, ticks[ticks.length - 1]]}
              />
              <Tooltip
                cursor={{ fill: 'rgb(var(--surface-2))', opacity: 0.7 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const row = payload[0].payload as Record<string, number | string>
                  const parts = keys.filter((k) => (row[k] as number) > 0).sort((a, b) => (row[b] as number) - (row[a] as number))
                  return (
                    <TipBox title={`${formatDate(row.date as string)} · ${weekdayName(row.date as string)}`}>
                      <div className="mb-1 text-muted">Toplam: {formatMinutes(row.total as number)}</div>
                      {parts.map((k) => (
                        <div key={k} className="flex items-center gap-1.5 text-muted">
                          <Dot color={k === 'diger' ? OTHER_COLOR : subjectColor(k)} size={7} />
                          <span>{k === 'diger' ? 'Dersiz' : subjectShortFull(k)}</span>
                          <span className="tabular ml-auto pl-3 text-text">{formatMinutes(row[k] as number)}</span>
                        </div>
                      ))}
                    </TipBox>
                  )
                }}
              />
              {showGoal && (
                <ReferenceLine
                  y={goal}
                  stroke="rgb(var(--success))"
                  strokeDasharray="5 4"
                  label={{ value: 'Hedef', position: 'insideTopRight', fill: 'rgb(var(--success))', fontSize: 10 }}
                />
              )}
              {keys.map((k) => (
                <Bar
                  key={k}
                  dataKey={k}
                  stackId="s"
                  fill={k === 'diger' ? OTHER_COLOR : subjectColor(k)}
                  maxBarSize={28}
                  animationDuration={300}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Haftanın günlerine göre ortalama                                    */
/* ------------------------------------------------------------------ */

export function WeekdayChart({ byDay }: { byDay: Map<string, number> }): React.JSX.Element {
  const { rows, any, best, ticks } = useMemo(() => {
    const today = todayKey()
    const weeks = 12
    const sums = Array(7).fill(0) as number[]
    const counts = Array(7).fill(0) as number[]
    for (let i = 0; i < weeks * 7; i++) {
      const d = addDays(today, -i)
      const dow = (fromKey(d).getDay() + 6) % 7
      sums[dow] += byDay.get(d) ?? 0
      counts[dow]++
    }
    const rows = DAYS_SHORT.map((label, i) => ({ label, full: DAYS[i], avg: Math.round(sums[i] / Math.max(1, counts[i])) }))
    const maxAvg = Math.max(...rows.map((r) => r.avg))
    return { rows, any: maxAvg > 0, best: maxAvg > 0 ? rows.findIndex((r) => r.avg === maxAvg) : -1, ticks: minuteTicks(maxAvg) }
  }, [byDay])

  return (
    <Card className="flex h-full flex-col">
      <CardHeader icon={<CalendarDays size={16} />} title="Haftanın günlerine göre" subtitle="Son 12 haftanın günlük ortalaması" />
      <div className="min-h-[220px] flex-1 px-3 pb-4 pt-3">
        {!any ? (
          <EmptyState icon={<CalendarDays size={20} />} title="Henüz veri yok" description="Hangi günler daha verimli olduğunu burada göreceksin." />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="rgb(var(--border))" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={tick} tickLine={false} axisLine={false} />
              <YAxis tick={tick} tickLine={false} axisLine={false} width={44} tickFormatter={hoursTick} ticks={ticks} domain={[0, ticks[ticks.length - 1]]} />
              <Tooltip
                cursor={{ fill: 'rgb(var(--surface-2))', opacity: 0.7 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const r = payload[0].payload as (typeof rows)[number]
                  return (
                    <TipBox title={r.full}>
                      <div className="text-muted">Ortalama: {formatMinutes(r.avg)}</div>
                    </TipBox>
                  )
                }}
              />
              <Bar dataKey="avg" radius={[6, 6, 0, 0]} maxBarSize={36} animationDuration={300}>
                {rows.map((_, i) => (
                  <Cell key={i} fill="rgb(var(--accent))" fillOpacity={i === best ? 1 : 0.45} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      {any && best >= 0 && (
        <div className="px-5 pb-4 text-xs text-muted">
          En verimli günün <span className="font-semibold text-text">{rows[best].full}</span> ({formatMinutes(rows[best].avg)} ortalama).
        </div>
      )}
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Ders dağılımı (donut + liste)                                       */
/* ------------------------------------------------------------------ */

export function SubjectDistribution({ sessions }: { sessions: StudySession[] }): React.JSX.Element {
  const [range, setRange] = useState<'30' | 'all'>('30')

  const { rows, total } = useMemo(() => {
    const from = range === '30' ? addDays(todayKey(), -29) : ''
    const m = new Map<string, number>()
    for (const s of sessions) {
      if (s.date < from) continue
      const k = s.subjectId ?? 'diger'
      m.set(k, (m.get(k) ?? 0) + s.minutes)
    }
    const rows = [...m.entries()]
      .map(([id, minutes]) => ({
        id,
        minutes,
        name: id === 'diger' ? 'Dersiz' : subjectFullName(id),
        color: id === 'diger' ? OTHER_COLOR : subjectColor(id)
      }))
      .sort((a, b) => b.minutes - a.minutes)
    return { rows, total: rows.reduce((a, r) => a + r.minutes, 0) }
  }, [sessions, range])

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        icon={<PieIcon size={16} />}
        title="Ders dağılımı"
        subtitle="Zamanını hangi derslere harcıyorsun?"
        action={
          <Segmented
            size="sm"
            value={range}
            onChange={setRange}
            options={[
              { value: '30', label: '30 gün' },
              { value: 'all', label: 'Tümü' }
            ]}
          />
        }
      />
      {total === 0 ? (
        <EmptyState className="flex-1" icon={<PieIcon size={20} />} title="Dağılım için veri yok" description="Çalışma eklerken ders seçersen dağılım burada görünür." />
      ) : (
        <div className="grid flex-1 grid-cols-[180px_1fr] items-center gap-5 px-5 pb-5 pt-3">
          <div className="relative h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={rows} dataKey="minutes" nameKey="name" innerRadius={56} outerRadius={84} paddingAngle={2} stroke="none" animationDuration={300}>
                  {rows.map((r) => (
                    <Cell key={r.id} fill={r.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const r = payload[0].payload as (typeof rows)[number]
                    return (
                      <TipBox title={r.name}>
                        <div className="text-muted">
                          {formatMinutes(r.minutes)} · %{Math.round((r.minutes / total) * 100)}
                        </div>
                      </TipBox>
                    )
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
              <div>
                <div className="tabular text-lg font-semibold">{Math.round((total / 60) * 10) / 10}</div>
                <div className="text-[10px] uppercase tracking-wide text-subtle">saat</div>
              </div>
            </div>
          </div>
          <div className="min-w-0 space-y-2">
            {rows.slice(0, 7).map((r) => (
              <div key={r.id}>
                <div className="flex items-center gap-2 text-xs">
                  <Dot color={r.color} />
                  <span className="min-w-0 flex-1 truncate font-medium text-text">{r.name}</span>
                  <span className="tabular text-muted">{formatMinutes(r.minutes)}</span>
                  <span className="tabular w-9 text-right text-subtle">%{Math.round((r.minutes / total) * 100)}</span>
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-3">
                  <div className="h-full rounded-full" style={{ width: `${(r.minutes / rows[0].minutes) * 100}%`, background: r.color }} />
                </div>
              </div>
            ))}
            {rows.length > 7 && <div className="text-[11px] text-subtle">+{rows.length - 7} ders daha</div>}
          </div>
        </div>
      )}
    </Card>
  )
}
