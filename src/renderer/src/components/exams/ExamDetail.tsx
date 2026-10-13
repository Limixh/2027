import { ArrowDownRight, ArrowUpRight, Clock, Minus, Pencil, Trash2 } from 'lucide-react'
import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ExamMistake, ExamResult } from '../../../../shared/types'
import { Badge, Button, Dot, Modal, ProgressBar, cn } from '@/components/ui'
import { SUBJECT_MAP, TOPIC_MAP } from '@/data/curriculum'
import { formatDate, formatMinutes } from '@/lib/date'
import { MISTAKE_KIND_COLOR, MISTAKE_KIND_LABEL, fmtNet, net, round2, totalNet, totals } from '@/lib/exam'
import { useStore } from '@/lib/store'
import { estimateFor, examSubjects, previousExams, signed, successRatio } from './helpers'

const tickStyle = { fill: 'rgb(var(--subtle))', fontSize: 11 }

function Delta({ value, suffix = '' }: { value: number; suffix?: string }): React.JSX.Element {
  const up = value > 0.004
  const down = value < -0.004
  return (
    <span
      className={cn(
        'tabular inline-flex items-center gap-0.5 text-xs font-semibold',
        up ? 'text-success' : down ? 'text-danger' : 'text-subtle'
      )}
    >
      {up ? <ArrowUpRight size={13} /> : down ? <ArrowDownRight size={13} /> : <Minus size={13} />}
      {signed(value, fmtNet)}
      {suffix}
    </span>
  )
}

export default function ExamDetail({
  exam,
  onClose,
  onEdit,
  onDelete
}: {
  exam: ExamResult
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
}): React.JSX.Element {
  const exams = useStore((s) => s.data.exams)
  const settings = useStore((s) => s.data.settings)

  const subjects = useMemo(() => examSubjects(exam), [exam])
  const prev = useMemo(() => previousExams(exam, exams), [exam, exams])
  const tot = totals(exam)
  const est = useMemo(() => estimateFor(exam, exams, settings), [exam, exams, settings])
  const prevAvgTotal = prev.length ? round2(prev.reduce((a, e) => a + totalNet(e), 0) / prev.length) : null
  const lastPrev = prev.length ? prev[prev.length - 1] : null

  const rows = useMemo(
    () =>
      subjects.map((s) => {
        const sc = exam.scores[s.id]
        const ps = prev.filter((e) => e.scores[s.id])
        const prevAvg = ps.length ? ps.reduce((a, e) => a + net(e.scores[s.id]), 0) / ps.length : null
        const prevSuccess = ps.length ? ps.reduce((a, e) => a + successRatio(e.scores[s.id], s.id), 0) / ps.length : null
        return { subject: s, score: sc, net: round2(net(sc)), success: successRatio(sc, s.id), prevAvg, prevSuccess }
      }),
    [subjects, exam, prev]
  )

  const chartData = rows.map((r) => ({
    name: r.subject.short,
    color: r.subject.color,
    bu: Math.round(r.success * 100),
    onceki: r.prevSuccess === null ? null : Math.round(r.prevSuccess * 100)
  }))

  /* ---- hata analizi ---- */
  const mistakeTotal = exam.mistakes.reduce((a, m) => a + m.count, 0)
  const byKind = useMemo(() => {
    const m: Record<string, number> = {}
    for (const x of exam.mistakes) m[x.kind] = (m[x.kind] ?? 0) + x.count
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }, [exam.mistakes])
  const bySubject = useMemo(() => {
    const out = new Map<string, Map<string, ExamMistake[]>>()
    for (const m of exam.mistakes) {
      const sm = out.get(m.subjectId) ?? new Map<string, ExamMistake[]>()
      sm.set(m.topicId, [...(sm.get(m.topicId) ?? []), m])
      out.set(m.subjectId, sm)
    }
    return [...out.entries()]
      .map(([sid, tm]) => {
        const topics = [...tm.entries()]
          .map(([tid, ms]) => ({ tid, ms, count: ms.reduce((a, x) => a + x.count, 0) }))
          .sort((a, b) => b.count - a.count)
        return { sid, topics, count: topics.reduce((a, t) => a + t.count, 0) }
      })
      .sort((a, b) => b.count - a.count)
  }, [exam.mistakes])

  return (
    <Modal
      open
      onClose={onClose}
      width={940}
      title={
        <span className="inline-flex items-center gap-2">
          <Badge color={exam.type === 'TYT' ? '#6366f1' : '#ec4899'}>{exam.type}</Badge>
          {exam.name}
        </span>
      }
      subtitle={
        <span className="inline-flex items-center gap-2">
          {formatDate(exam.date)}
          {exam.durationMin ? (
            <span className="inline-flex items-center gap-1">
              <Clock size={11} /> {formatMinutes(exam.durationMin)}
            </span>
          ) : null}
        </span>
      }
      footer={
        <>
          <Button variant="danger" icon={<Trash2 size={14} />} onClick={onDelete} className="mr-auto">
            Sil
          </Button>
          <Button variant="outline" icon={<Pencil size={14} />} onClick={onEdit}>
            Düzenle
          </Button>
          <Button variant="primary" onClick={onClose}>
            Kapat
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Özet */}
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-12 rounded-xl border border-border bg-surface-2/60 p-4 sm:col-span-4">
            <div className="text-xs font-medium text-muted">Toplam net</div>
            <div className="tabular mt-1 text-4xl font-semibold tracking-tight">{fmtNet(tot.net)}</div>
            <div className="mt-1.5 flex items-center gap-3 text-xs">
              <span className="text-muted">
                D <b className="tabular text-success">{tot.correct}</b>
              </span>
              <span className="text-muted">
                Y <b className="tabular text-danger">{tot.wrong}</b>
              </span>
              <span className="text-muted">
                B <b className="tabular text-text">{tot.blank}</b>
              </span>
            </div>
          </div>
          <div className="col-span-6 rounded-xl border border-border bg-surface-2/60 p-4 sm:col-span-4">
            <div className="text-xs font-medium text-muted">Önceki denemelerle</div>
            {prevAvgTotal === null ? (
              <div className="mt-2 text-sm text-muted">Karşılaştırılacak önceki {exam.type} denemesi yok.</div>
            ) : (
              <div className="mt-2 space-y-1.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted">Ortalamaya göre ({prev.length})</span>
                  <Delta value={round2(tot.net - prevAvgTotal)} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">Bir öncekine göre</span>
                  <Delta value={round2(tot.net - totalNet(lastPrev!))} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">Önceki ortalama</span>
                  <span className="tabular font-semibold">{fmtNet(prevAvgTotal)}</span>
                </div>
              </div>
            )}
          </div>
          <div className="col-span-6 rounded-xl border border-border bg-surface-2/60 p-4 sm:col-span-4">
            <div className="flex items-center justify-between text-xs font-medium text-muted">
              <span>{est ? `Tahmini ${est.label.toLocaleLowerCase('tr-TR')}` : 'Tahmini puan'}</span>
              <Badge>≈ tahmini</Badge>
            </div>
            {est ? (
              <>
                <div className="tabular mt-1 text-3xl font-semibold tracking-tight">{fmtNet(est.raw)}</div>
                <div className="mt-1 text-xs text-muted">
                  Yerleştirme (OBP {settings.obp}) ≈ <b className="tabular text-text">{fmtNet(est.place)}</b>
                </div>
              </>
            ) : (
              <div className="mt-2 text-sm text-muted">
                {exam.type === 'AYT'
                  ? 'Alan puanı için ayarlardaki alana ait dersler ve en az bir TYT denemesi gerekir.'
                  : 'Hesaplanamadı.'}
              </div>
            )}
          </div>
        </div>

        {/* Ders tablosu + grafik */}
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 overflow-hidden rounded-xl border border-border lg:col-span-7">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-2 text-[10px] font-medium uppercase tracking-wide text-subtle">
                  <th className="px-3 py-2 text-left">Ders</th>
                  <th className="px-1 py-2 text-center">D</th>
                  <th className="px-1 py-2 text-center">Y</th>
                  <th className="px-1 py-2 text-center">B</th>
                  <th className="px-2 py-2 text-right">Net</th>
                  <th className="w-28 px-3 py-2 text-left">Başarı</th>
                  <th className="px-3 py-2 text-right">Önc. ort.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {rows.map((r) => (
                  <tr key={r.subject.id} className="hover:bg-surface-2/50">
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-2 font-medium">
                        <Dot color={r.subject.color} />
                        {r.subject.name}
                      </span>
                    </td>
                    <td className="tabular px-1 text-center text-success">{r.score.correct}</td>
                    <td className="tabular px-1 text-center text-danger">{r.score.wrong}</td>
                    <td className="tabular px-1 text-center text-muted">{r.score.blank}</td>
                    <td className="tabular px-2 text-right font-semibold">{fmtNet(r.net)}</td>
                    <td className="px-3">
                      <div className="flex items-center gap-2">
                        <ProgressBar value={r.success} color={r.subject.color} height={5} />
                        <span className="tabular w-9 shrink-0 text-right text-xs text-muted">%{Math.round(r.success * 100)}</span>
                      </div>
                    </td>
                    <td className="px-3 text-right">
                      {r.prevAvg === null ? (
                        <span className="text-xs text-subtle">–</span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="tabular text-xs text-muted">{fmtNet(round2(r.prevAvg))}</span>
                          <Delta value={round2(r.net - r.prevAvg)} />
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="col-span-12 rounded-xl border border-border p-3 lg:col-span-5">
            <div className="mb-1 flex items-center justify-between px-1">
              <span className="text-xs font-semibold">Ders başarısı (%)</span>
              <span className="flex items-center gap-3 text-[10px] text-muted">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-sm bg-accent" /> Bu deneme
                </span>
                {prev.length > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-sm bg-surface-3 ring-1 ring-border" /> Önceki ort.
                  </span>
                )}
              </span>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 4, left: -8, bottom: 0 }} barGap={2}>
                  <CartesianGrid stroke="rgb(var(--border))" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={tickStyle} tickLine={false} axisLine={false} interval={0} />
                  <YAxis domain={[0, 100]} tick={tickStyle} tickLine={false} axisLine={false} width={34} />
                  <Tooltip
                    cursor={{ fill: 'rgb(var(--surface-2))' }}
                    content={({ active, payload, label }) =>
                      active && payload?.length ? (
                        <div className="card px-3 py-2 text-xs shadow-lg">
                          <div className="mb-1 font-semibold">{label}</div>
                          {payload.map((p) => (
                            <div key={String(p.dataKey)} className="flex justify-between gap-4 text-muted">
                              <span>{p.dataKey === 'bu' ? 'Bu deneme' : 'Önceki ort.'}</span>
                              <b className="tabular text-text">%{p.value}</b>
                            </div>
                          ))}
                        </div>
                      ) : null
                    }
                  />
                  {prev.length > 0 && (
                    <Bar dataKey="onceki" fill="rgb(var(--surface-3))" radius={[4, 4, 0, 0]} maxBarSize={16} animationDuration={300} />
                  )}
                  <Bar dataKey="bu" radius={[4, 4, 0, 0]} maxBarSize={22} animationDuration={300}>
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Hata analizi */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Yanlış / boş konu analizi</h3>
            {mistakeTotal > 0 && (
              <span className="text-xs text-muted">
                {mistakeTotal} soru konulara dağıtıldı <span className="text-subtle">(toplam {tot.wrong + tot.blank})</span>
              </span>
            )}
          </div>
          {mistakeTotal === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-xs text-muted">
              Bu denemeye konu analizi girilmemiş. “Düzenle” ile yanlış ve boş soruların konularını ekleyebilirsin.
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-3">
                  {byKind.map(([k, c]) => (
                    <div key={k} style={{ width: `${(c / mistakeTotal) * 100}%`, background: MISTAKE_KIND_COLOR[k] }} title={MISTAKE_KIND_LABEL[k]} />
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  {byKind.map(([k, c]) => (
                    <span key={k} className="inline-flex items-center gap-1.5 text-xs text-muted">
                      <Dot color={MISTAKE_KIND_COLOR[k]} size={7} />
                      {MISTAKE_KIND_LABEL[k]} <b className="tabular text-text">{c}</b>
                    </span>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {bySubject.map((s) => {
                  const subj = SUBJECT_MAP[s.sid]
                  return (
                    <div key={s.sid} className="rounded-xl border border-border p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="inline-flex items-center gap-2 text-sm font-semibold">
                          <Dot color={subj?.color ?? '#888'} />
                          {subj?.name ?? s.sid}
                        </span>
                        <span className="tabular text-xs text-muted">{s.count} soru</span>
                      </div>
                      <ul className="space-y-1.5">
                        {s.topics.map((t) => (
                          <li key={t.tid} className="flex items-start justify-between gap-2 text-[13px]">
                            <div className="min-w-0">
                              <div className="truncate">{TOPIC_MAP[t.tid]?.name ?? 'Bilinmeyen konu'}</div>
                              <div className="mt-0.5 flex flex-wrap gap-1">
                                {t.ms.map((m) => (
                                  <Badge key={m.id} color={MISTAKE_KIND_COLOR[m.kind]}>
                                    {MISTAKE_KIND_LABEL[m.kind]} ×{m.count}
                                  </Badge>
                                ))}
                              </div>
                              {t.ms.some((m) => m.note) && (
                                <div className="mt-0.5 text-[11px] italic text-subtle">{t.ms.filter((m) => m.note).map((m) => m.note).join(' · ')}</div>
                              )}
                            </div>
                            <b className="tabular shrink-0 text-sm">{t.count}</b>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {exam.note && (
          <div className="rounded-xl border border-border bg-surface-2/60 px-4 py-3">
            <div className="mb-1 text-xs font-medium text-muted">Notlar</div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{exam.note}</p>
          </div>
        )}
      </div>
    </Modal>
  )
}
