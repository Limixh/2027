import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { RES_COLOR, RES_LABEL, fmtDur, type Res } from './lib'

/** Soru başına süre (sn) çubukları, sonuca göre renkli */
export function QuestionChart({
  times,
  results,
  avg,
  height = 180
}: {
  times: number[]
  results: Res[]
  avg?: number
  height?: number
}): React.JSX.Element {
  const data = times.map((t, i) => ({ n: i + 1, t, r: results[i] ?? 'B' }))
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
          <XAxis dataKey="n" tick={{ fill: 'rgb(var(--subtle))', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: 'rgb(var(--subtle))', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: 'rgb(var(--surface-2))', opacity: 0.6 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const d = payload[0].payload as { n: number; t: number; r: Res }
              return (
                <div className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs shadow-card">
                  <div className="text-muted">{d.n}. soru</div>
                  <div className="tabular font-medium text-text">
                    {fmtDur(d.t)} · {RES_LABEL[d.r]}
                  </div>
                </div>
              )
            }}
          />
          {avg ? <ReferenceLine y={avg} stroke="rgb(var(--muted))" strokeDasharray="3 4" /> : null}
          <Bar dataKey="t" radius={[3, 3, 0, 0]} maxBarSize={22} animationDuration={300}>
            {data.map((d, i) => (
              <Cell key={i} fill={RES_COLOR[d.r]} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
