import { CalendarCheck, Check, ListChecks, Sparkles, X } from 'lucide-react'
import { useMemo } from 'react'
import { SUBJECT_MAP, TOPIC_MAP } from '@/data/curriculum'
import { applyAction, describeAction, normalizeExam, planDate, toPlanTask, type AiAction } from '@/lib/aiActions'
import { fmtNet, MISTAKE_KIND_LABEL } from '@/lib/exam'
import { useNav } from '@/lib/nav'
import { useStore } from '@/lib/store'
import { Button, cn, Dot, toast } from '../ui'

const KIND_LABEL: Record<string, string> = { konu: 'Konu', soru: 'Soru', tekrar: 'Tekrar', deneme: 'Deneme', diger: 'Diğer' }

function PlanPreview({ action }: { action: Extract<AiAction, { type: 'plan' }> }): React.JSX.Element {
  const tasks = useMemo(() => action.tasks.map(toPlanTask), [action])
  const total = tasks.reduce((a, t) => a + (t.targetMinutes ?? 0), 0)
  return (
    <div className="mt-2">
      {action.summary && <p className="mb-2 text-xs leading-relaxed text-muted">{action.summary}</p>}
      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
        {tasks.map((t, i) => {
          const subject = t.subjectId ? SUBJECT_MAP[t.subjectId] : undefined
          return (
            <div key={i} className="flex items-start gap-3 px-3 py-2">
              <span className="tabular w-11 shrink-0 pt-0.5 text-xs text-muted">{t.time ?? '—'}</span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{t.title}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted">
                  {subject && (
                    <span className="flex items-center gap-1">
                      <Dot color={subject.color} size={6} /> {subject.exam} {subject.short}
                    </span>
                  )}
                  {t.topicId && <span>{TOPIC_MAP[t.topicId]?.name}</span>}
                  {t.scope && <span>· {t.scope}</span>}
                </div>
              </div>
              <div className="shrink-0 text-right text-[11px] text-muted">
                <div className="rounded bg-surface-3 px-1.5 py-0.5 font-medium text-text">{KIND_LABEL[t.kind]}</div>
                <div className="mt-0.5">
                  {t.targetMinutes ? `${t.targetMinutes} dk` : ''}
                  {t.targetQuestions ? ` · ${t.targetQuestions} soru` : ''}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {total > 0 && <div className="mt-1.5 text-right text-[11px] text-muted">Toplam hedef: {Math.floor(total / 60)} sa {total % 60} dk</div>}
    </div>
  )
}

function ExamPreview({ action }: { action: Extract<AiAction, { type: 'exam' }> }): React.JSX.Element {
  const e = useMemo(() => normalizeExam(action), [action])
  return (
    <div className="mt-2 space-y-2">
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <table className="w-full text-xs">
          <thead className="bg-surface-2 text-muted">
            <tr>
              <th className="px-3 py-1.5 text-left font-medium">Ders</th>
              <th className="px-2 text-right font-medium">D</th>
              <th className="px-2 text-right font-medium">Y</th>
              <th className="px-2 text-right font-medium">B</th>
              <th className="px-3 text-right font-medium">Net</th>
            </tr>
          </thead>
          <tbody className="tabular divide-y divide-border">
            {Object.entries(e.scores).map(([id, sc]) => (
              <tr key={id}>
                <td className="px-3 py-1.5">
                  <span className="flex items-center gap-1.5">
                    <Dot color={SUBJECT_MAP[id].color} size={6} /> {SUBJECT_MAP[id].name}
                  </span>
                </td>
                <td className="px-2 text-right text-success">{sc.correct}</td>
                <td className="px-2 text-right text-danger">{sc.wrong}</td>
                <td className="px-2 text-right text-muted">{sc.blank}</td>
                <td className="px-3 text-right font-semibold">{fmtNet(sc.correct - sc.wrong / 4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {e.mistakes.length > 0 && (
        <div>
          <div className="mb-1 text-[11px] font-medium text-muted">Yanlış / boş konuları</div>
          <div className="flex flex-wrap gap-1.5">
            {e.mistakes.map((m) => (
              <span key={m.id} className="rounded-md bg-surface-3 px-2 py-0.5 text-[11px] text-text">
                {SUBJECT_MAP[m.subjectId]?.short} · {m.topicId ? TOPIC_MAP[m.topicId]?.name : m.note} ×{m.count}
                <span className="text-muted"> ({MISTAKE_KIND_LABEL[m.kind]})</span>
              </span>
            ))}
          </div>
        </div>
      )}
      {e.warnings.length > 0 && <div className="text-[11px] text-warning">{e.warnings.join(' · ')}</div>}
    </div>
  )
}

/** AI cevabındaki eylemleri onay kartı olarak gösterir */
export function ActionsCard({
  actions,
  state,
  onState
}: {
  actions: AiAction[]
  state?: 'applied' | 'rejected'
  onState: (s: 'applied' | 'rejected') => void
}): React.JSX.Element {
  const go = useNav((s) => s.go)
  const plans = useStore((s) => s.data.plans)
  const planActions = actions.filter((a): a is Extract<AiAction, { type: 'plan' }> => a.type === 'plan')
  const examActions = actions.filter((a) => a.type === 'exam')
  const hasExisting = planActions.some((a) => (plans[planDate(a)]?.tasks.length ?? 0) > 0)

  const apply = (mode: 'replace' | 'append'): void => {
    const errors = actions.map((a) => applyAction(a, mode)).filter(Boolean)
    onState('applied')
    if (errors.length) toast(`${actions.length - errors.length}/${actions.length} işlem uygulandı. ${errors[0]}`, 'error')
    else toast(planActions.length ? 'Plan kaydedildi' : examActions.length ? 'Deneme kaydedildi' : 'Uygulandı')
  }

  return (
    <div
      className={cn(
        'mt-3 rounded-2xl border p-4',
        state === 'applied' ? 'border-success/40 bg-success/5' : state === 'rejected' ? 'border-border opacity-60' : 'border-accent/40 bg-accent/5'
      )}
    >
      <div className="flex items-center gap-2 text-sm font-semibold">
        {planActions.length ? <ListChecks size={16} className="text-accent" /> : <Sparkles size={16} className="text-accent" />}
        {planActions.length ? 'Plan önerisi' : examActions.length ? 'Deneme sonucu' : 'Önerilen işlemler'}
        {state === 'applied' && <span className="ml-auto flex items-center gap-1 text-xs text-success"><Check size={13} /> Uygulandı</span>}
        {state === 'rejected' && <span className="ml-auto text-xs text-muted">Reddedildi</span>}
      </div>
      <ul className="mt-2 space-y-2">
        {actions.map((a, i) => (
          <li key={i} className="text-sm">
            <div className="flex items-center gap-2 text-text">
              <CalendarCheck size={14} className="shrink-0 text-muted" />
              {describeAction(a)}
            </div>
            {a.type === 'plan' && <PlanPreview action={a} />}
            {a.type === 'exam' && <ExamPreview action={a} />}
          </li>
        ))}
      </ul>
      {!state && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="primary" size="sm" icon={<Check size={14} />} onClick={() => apply('replace')}>
            {hasExisting ? 'Mevcut planın yerine koy' : 'Onayla'}
          </Button>
          {hasExisting && (
            <Button size="sm" onClick={() => apply('append')}>
              Mevcut plana ekle
            </Button>
          )}
          <Button size="sm" variant="ghost" icon={<X size={14} />} onClick={() => onState('rejected')}>
            Reddet
          </Button>
        </div>
      )}
      {state === 'applied' && examActions.length > 0 && (
        <div className="mt-3">
          <Button size="sm" variant="outline" onClick={() => go('exams')}>
            Denemelerde gör
          </Button>
        </div>
      )}
      {state === 'applied' && planActions.length > 0 && (
        <div className="mt-3">
          <Button size="sm" variant="outline" icon={<ListChecks size={14} />} onClick={() => go('room')}>
            Çalışma Odası'nda aç
          </Button>
        </div>
      )}
    </div>
  )
}
