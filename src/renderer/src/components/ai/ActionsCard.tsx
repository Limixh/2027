import { CalendarCheck, Check, ListChecks, Sparkles, X } from 'lucide-react'
import { useMemo } from 'react'
import { SUBJECT_MAP, TOPIC_MAP } from '@/data/curriculum'
import { applyAction, describeAction, planDate, toPlanTask, type AiAction } from '@/lib/aiActions'
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
  const hasExisting = planActions.some((a) => (plans[planDate(a)]?.tasks.length ?? 0) > 0)

  const apply = (mode: 'replace' | 'append'): void => {
    const errors = actions.map((a) => applyAction(a, mode)).filter(Boolean)
    onState('applied')
    if (errors.length) toast(`${actions.length - errors.length}/${actions.length} işlem uygulandı. ${errors[0]}`, 'error')
    else toast(planActions.length ? 'Plan kaydedildi' : 'Uygulandı')
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
        {planActions.length ? 'Plan önerisi' : 'Önerilen işlemler'}
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
