import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { PracticeSet } from '../../../../shared/types'
import { addDays, formatShort, startOfWeek, todayKey } from '@/lib/date'
import { DEFAULT_TARGET, RES_COLOR, aggregateDays, fmtDur, fmtNum, lsGet, lsSet } from './lib'

const AXIS = { fill: 'rgb(var(--subtle))', fontSize: 11 }

function Tip({ active, payload, label, render }: {
  active?: boolean
  payload?: { payload: Record<string, number | string> }[]
  label?: string
  render: (d: Record<string, number | string>) => React.ReactNode
}): React.JSX.Element | null {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs shadow-card">
      <div className="mb-0.5 text-muted">{label}</div>
      <div className="tabular text-text">{render(payload[0].payload)}</div>
    </div>
  )
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }): React.JSX.Element {
  return (
    <div className="min-w-0 px-5 first:pl-0 sm:border-l sm:border-border sm:first:border-l-0">
      <div className="text-xs text-muted">{label}</div>
      <div className="tabular mt-1 truncate text-2xl font-light tracking-tight text-text">{value}</div>
      {sub && <div className="tabular mt-0.5 truncate text-xs text-subtle">{sub}</div>}
    </div>
  )
}

function ChartBox({ title, right, children, className }: { title: string; right?: React.ReactNode; children: React.ReactNode; className?: string }): React.JSX.Element {
  return (
    <div className={className}>
      <div className="mb-3 flex min-h-[28px] items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-text">{title}</h3>
        {right}
      </div>
      {children}
    </div>
  )
}

export function PracticeStats({ sets }: { sets: PracticeSet[] }): React.JSX.Element {
  const [target, setTarget] = useState<number>(() => lsGet('yks-practice-target', DEFAULT_TARGET))
  const days = useMemo(() => aggregateDays(sets), [sets])
  const today = todayKey()
  const weekStart = startOfWeek(today)

  const k = useMemo(() => {
    const todayCount = days.find((d) => d.date === today)?.count ?? 0
    const week = days.filter((d) => d.date >= weekStart).reduce((a, d) => a + d.count, 0)
    const recent = [...sets].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).slice(0, 7)
    const rc = recent.reduce((a, s) => a + s.count, 0)
    const avg = rc ? recent.reduce((a, s) => a + s.seconds, 0) / rc : 0
    const count = sets.reduce((a, s) => a + s.count, 0)
    const correct = sets.reduce((a, s) => a + s.correct, 0)
    const best = sets.filter((s) => s.count >= 5).reduce<number>((m, s) => Math.min(m, s.seconds / s.count), Infinity)
    return { todayCount, week, avg, acc: count ? (correct / count) * 100 : 0, count, best: Number.isFinite(best) ? best : 0 }
  }, [sets, days, today, weekStart])

  const chartDays = useMemo(() => {
    const from = addDays(today, -29)
    return days
      .filter((d) => d.date >= from)
      .map((d) => ({ ...d, label: formatShort(d.date), avg: Math.round(d.avg), acc: Math.round(d.acc) }))
  }, [days, today])

  const setTargetSave = (v: number): void => {
    setTarget(v)
    lsSet('yks-practice-target', v)
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-y-5 sm:grid-cols-5">
        <Kpi label="Bugün çözülen" value={String(k.todayCount)} sub="soru" />
        <Kpi label="Bu hafta" value={String(k.week)} sub="soru" />
        <Kpi
          label="Ort. süre / soru"
          value={k.avg ? fmtDur(k.avg) : '—'}
          sub={k.avg ? `son 7 set · hedef ${fmtDur(target)}` : undefined}
        />
        <Kpi label="Doğruluk" value={k.count ? `%${fmtNum(k.acc, 0)}` : '—'} sub={`${k.count} soru`} />
        <Kpi label="En hızlı ortalama" value={k.best ? fmtDur(k.best) : '—'} sub="tek set" />
      </div>

      {chartDays.length === 0 ? (
        <p className="border-t border-border pt-6 text-sm text-muted">Son 30 günde bu filtre için kayıt yok.</p>
      ) : (
        <div className="grid grid-cols-1 gap-x-10 gap-y-8 border-t border-border pt-6 lg:grid-cols-2">
          <ChartBox
            title="Soru başına ortalama süre (sn)"
            right={
              <label className="flex items-center gap-1.5 text-xs text-muted">
                Hedef
                <input
                  type="number"
                  min={5}
                  max={600}
                  value={target}
                  onChange={(e) => setTargetSave(Math.max(1, Number(e.target.value) || DEFAULT_TARGET))}
                  className="tabular h-7 w-14 rounded-md border border-border bg-transparent px-1.5 text-center text-xs text-text outline-none focus:border-accent"
                />
                sn
              </label>
            }
          >
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartDays} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="rgb(var(--border))" strokeOpacity={0.6} vertical={false} />
                  <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
                  <YAxis tick={AXIS} axisLine={false} tickLine={false} domain={[0, (m: number) => Math.max(m, target) + 10]} />
                  <Tooltip content={<Tip render={(d) => `${fmtDur(Number(d.avg))} / soru · ${d.count} soru`} />} />
                  <ReferenceLine y={target} stroke="rgb(var(--success))" strokeDasharray="4 4" strokeOpacity={0.8} />
                  <Line type="monotone" dataKey="avg" stroke="rgb(var(--accent))" strokeWidth={2} dot={{ r: 3, fill: 'rgb(var(--accent))', strokeWidth: 0 }} animationDuration={400} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ChartBox>

          <ChartBox
            title="Günlük soru sayısı"
            right={
              <span className="flex gap-3 text-xs text-muted">
                {(['D', 'Y', 'B'] as const).map((r) => (
                  <span key={r}>
                    <span style={{ color: RES_COLOR[r] }}>●</span> {r}
                  </span>
                ))}
              </span>
            }
          >
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartDays} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="rgb(var(--border))" strokeOpacity={0.6} vertical={false} />
                  <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
                  <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: 'rgb(var(--surface-2))', opacity: 0.6 }}
                    content={<Tip render={(d) => `${d.correct}D ${d.wrong}Y ${d.blank}B · ${d.count} soru`} />}
                  />
                  <Bar dataKey="correct" stackId="a" fill={RES_COLOR.D} fillOpacity={0.85} maxBarSize={26} animationDuration={300} />
                  <Bar dataKey="wrong" stackId="a" fill={RES_COLOR.Y} fillOpacity={0.85} maxBarSize={26} animationDuration={300} />
                  <Bar dataKey="blank" stackId="a" fill={RES_COLOR.B} fillOpacity={0.6} radius={[3, 3, 0, 0]} maxBarSize={26} animationDuration={300} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartBox>

          <ChartBox title="Doğruluk (%)" className="lg:col-span-2">
            <div className="h-[150px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartDays} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="rgb(var(--border))" strokeOpacity={0.6} vertical={false} />
                  <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
                  <YAxis tick={AXIS} axisLine={false} tickLine={false} domain={[0, 100]} ticks={[0, 50, 100]} />
                  <Tooltip content={<Tip render={(d) => `%${d.acc} doğru · ${d.count} soru`} />} />
                  <Line type="monotone" dataKey="acc" stroke="rgb(var(--success))" strokeWidth={2} dot={{ r: 3, fill: 'rgb(var(--success))', strokeWidth: 0 }} animationDuration={400} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ChartBox>
        </div>
      )}
    </div>
  )
}
