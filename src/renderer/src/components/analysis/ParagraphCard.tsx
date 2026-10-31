import { useMemo } from 'react'
import { ScanText } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui'
import { useStore } from '@/lib/store'
import { QTYPE_LABEL, TRAP_HINT, TRAP_LABEL, fmtSeconds, paragraphStats } from '@/lib/paragraph'

/** Paragraf: soru tipine göre pratik doğruluğu ve süre, hata defterindeki sorular ve en sık düşülen tuzak */
export function ParagraphCard(): React.JSX.Element | null {
  const data = useStore((s) => s.data)
  const st = useMemo(() => paragraphStats(data), [data])
  if (!st.rows.length && !st.notes) return null
  const maxTrap = st.traps[0]?.count ?? 0
  const topTrap = st.traps[0]

  return (
    <Card>
      <CardHeader
        icon={<ScanText size={16} />}
        title="Paragraf"
        subtitle="Soru tipine göre doğruluk ve süre (Soru Pratiği) · hata defterindeki paragraf soruları ve tuzaklar"
      />
      <div className="grid grid-cols-1 gap-6 px-5 pb-5 pt-4 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-subtle">
                <th className="pb-2 font-medium">Soru tipi</th>
                <th className="pb-2 text-right font-medium">Doğruluk</th>
                <th className="pb-2 text-right font-medium">Soru başı</th>
                <th className="pb-2 text-right font-medium">Hata defteri</th>
              </tr>
            </thead>
            <tbody>
              {st.rows.map((r) => {
                const acc = r.solved ? r.correct / r.solved : undefined
                const per = r.solved ? Math.round(r.seconds / r.solved) : undefined
                const col = acc === undefined ? undefined : acc < 0.5 ? 'rgb(var(--danger))' : acc < 0.75 ? 'rgb(var(--warning))' : 'rgb(var(--success))'
                return (
                  <tr key={r.qType} className="border-t border-border">
                    <td className="py-2 text-text">{QTYPE_LABEL[r.qType]}</td>
                    <td className="tabular py-2 text-right">
                      {acc === undefined ? (
                        <span className="text-subtle">—</span>
                      ) : (
                        <>
                          <b style={{ color: col }}>%{Math.round(acc * 100)}</b> <span className="text-xs text-subtle">· {r.solved}</span>
                        </>
                      )}
                    </td>
                    <td className="tabular py-2 text-right">
                      {per ? <span className={per > 90 ? 'text-warning' : 'text-muted'}>{fmtSeconds(per)}</span> : <span className="text-subtle">—</span>}
                    </td>
                    <td className="tabular py-2 text-right text-muted">{r.mistakes || <span className="text-subtle">—</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="mt-3 text-[11px] text-subtle">
            {st.avgPracticeSeconds ? `Pratikte soru başı ortalama ${fmtSeconds(st.avgPracticeSeconds)} (hedef ~1 dk). ` : ''}
            {st.avgNoteSeconds ? `Yanlış yaptığın sorularda ortalama ${fmtSeconds(st.avgNoteSeconds)}.` : ''}
            {!st.avgPracticeSeconds && !st.avgNoteSeconds && 'Soru Pratiği’nde paragraf konusu seçip süre tutarsan tip bazında hız da görünür.'}
          </p>
        </div>

        <div>
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-subtle">En sık düştüğün tuzaklar</div>
          {st.traps.length === 0 ? (
            <p className="text-xs leading-relaxed text-muted">
              Paragraf sorularını AI ile analiz ettirdikçe hangi tuzağa düştüğün burada birikir ({st.notes} paragraf sorusu kayıtlı).
            </p>
          ) : (
            <>
              <ul className="space-y-2">
                {st.traps.map((t) => (
                  <li key={t.trap}>
                    <div className="mb-1 flex justify-between gap-2 text-[13px]">
                      <span className="text-text">{TRAP_LABEL[t.trap]}</span>
                      <span className="tabular text-muted">{t.count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-3">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${(t.count / maxTrap) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
              {topTrap && TRAP_HINT[topTrap.trap] && (
                <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-xs leading-relaxed text-muted">
                  <b className="text-text">Odak:</b> {TRAP_HINT[topTrap.trap]}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </Card>
  )
}
