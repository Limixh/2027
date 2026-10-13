// Günün planı: görev listesi, başlat / bitti akışı, ekleme ve düzenleme.
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { PlanTask } from '../../../../shared/types'
import { SUBJECT_MAP, TOPIC_MAP } from '@/data/curriculum'
import { cn, confirm, toast } from '@/components/ui'
import { useStopwatch } from '@/lib/clocks'
import { formatMinutes } from '@/lib/date'
import { useNav } from '@/lib/nav'
import { useStore } from '@/lib/store'
import CompleteModal from './CompleteModal'
import { KIND_LABEL } from './meta'
import { IconBtn } from './parts'
import { useActiveTask } from './stores'
import TaskForm from './TaskForm'
import { Btn } from './Tools'

interface RowProps {
  task: PlanTask
  index: number
  count: number
  active: boolean
  onStart(): void
  onFinish(): void
  onEdit(): void
  onDelete(): void
  onUndo(): void
  onMove(dir: -1 | 1): void
}

function TaskRow({ task, index, count, active, onStart, onFinish, onEdit, onDelete, onUndo, onMove }: RowProps): React.JSX.Element {
  const subject = task.subjectId ? SUBJECT_MAP[task.subjectId] : undefined
  const topic = task.topicId ? TOPIC_MAP[task.topicId] : undefined
  const meta = [
    subject?.short ?? (task.kind !== 'diger' ? KIND_LABEL[task.kind] : undefined),
    topic?.name,
    task.scope,
    task.targetMinutes ? `${task.targetMinutes} dk` : undefined,
    task.targetQuestions ? `${task.targetQuestions} soru` : undefined,
    task.time
  ].filter(Boolean)
  const act = 'rounded-full px-2.5 py-1 text-xs font-medium text-muted transition hover:bg-text/[0.08] hover:text-text'

  return (
    <div className="group flex items-start gap-3.5 border-b border-border/50 pb-1.5 pt-3.5">
      <button
        onClick={task.done ? onUndo : onFinish}
        className={cn(
          'mt-[1px] grid h-5 w-5 shrink-0 place-items-center rounded-full border transition',
          task.done ? 'border-text/60 bg-text/60 text-bg' : 'border-muted/60 text-transparent hover:border-text hover:text-text/60'
        )}
        aria-label={task.done ? 'Geri al' : 'Bitti olarak işaretle'}
        title={task.done ? 'Geri al' : 'Bitti'}
      >
        <Check size={12} strokeWidth={3} />
      </button>
      <div className="min-w-0 flex-1">
        <div className={cn('text-[15px] leading-snug text-text', active && 'font-medium', task.done && 'text-muted line-through decoration-muted/50')}>
          {active && !task.done && <span className="mr-2 inline-block h-1.5 w-1.5 -translate-y-[2px] animate-pulse rounded-full bg-accent" />}
          {task.title}
        </div>
        {(meta.length > 0 || task.source === 'ai') && (
          <div className="mt-1 flex items-center gap-1.5 text-xs leading-relaxed text-muted">
            <span className={cn('min-w-0', task.done && 'opacity-70')}>{meta.join(' · ')}</span>
            {task.source === 'ai' && <Sparkles size={11} className="shrink-0 opacity-70" aria-label="AI Koç önerisi" />}
          </div>
        )}
        <div
          className={cn(
            '-ml-2.5 mt-0.5 flex h-7 items-center gap-0.5 transition',
            active && !task.done
              ? 'opacity-100'
              : 'pointer-events-none opacity-0 focus-within:pointer-events-auto focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100'
          )}
        >
          {task.done ? (
            <button className={act} onClick={onUndo}>
              Geri al
            </button>
          ) : (
            <>
              {!active && (
                <button className={act} onClick={onStart}>
                  Başlat
                </button>
              )}
              <button className={cn(act, 'text-text')} onClick={onFinish}>
                Bitti
              </button>
            </>
          )}
          <IconBtn onClick={() => onMove(-1)} disabled={index === 0} aria-label="Yukarı taşı" title="Yukarı taşı">
            <ArrowUp size={14} />
          </IconBtn>
          <IconBtn onClick={() => onMove(1)} disabled={index === count - 1} aria-label="Aşağı taşı" title="Aşağı taşı">
            <ArrowDown size={14} />
          </IconBtn>
          <IconBtn onClick={onEdit} aria-label="Düzenle" title="Düzenle">
            <Pencil size={13} />
          </IconBtn>
          <IconBtn onClick={onDelete} className="hover:bg-danger/15 hover:text-danger" aria-label="Sil" title="Sil">
            <Trash2 size={13} />
          </IconBtn>
        </div>
      </div>
    </div>
  )
}

export default function PlanPanel({ date, isToday }: { date: string; isToday: boolean }): React.JSX.Element {
  const go = useNav((s) => s.go)
  const plan = useStore((s) => s.data.plans[date])
  const deletePlanTask = useStore((s) => s.deletePlanTask)
  const movePlanTask = useStore((s) => s.movePlanTask)
  const reopenPlanTask = useStore((s) => s.reopenPlanTask)
  const activeId = useActiveTask((s) => s.taskId)

  const [form, setForm] = useState<{ task?: PlanTask } | null>(null)
  const [finishing, setFinishing] = useState<PlanTask | null>(null)

  const tasks = plan?.tasks ?? []
  const done = tasks.filter((t) => t.done).length
  const totalMin = useMemo(() => tasks.reduce((a, t) => a + (t.targetMinutes ?? 0), 0), [tasks])
  const doneMin = useMemo(() => tasks.filter((t) => t.done).reduce((a, t) => a + (t.targetMinutes ?? 0), 0), [tasks])

  const startTask = async (task: PlanTask): Promise<void> => {
    const sw = useStopwatch.getState()
    const at = useActiveTask.getState()
    if (at.taskId === task.id) return
    if (sw.running || sw.acc > 0) {
      const other = at.taskId && at.date ? useStore.getState().data.plans[at.date]?.tasks.find((t) => t.id === at.taskId) : undefined
      const ok = await confirm({
        title: 'Kronometre sıfırlansın mı?',
        message: other
          ? `“${other.title}” için çalışan kronometre sıfırlanacak ve “${task.title}” görevi için yeniden başlayacak.`
          : `Kronometre sıfırlanacak ve “${task.title}” görevi için yeniden başlayacak.`,
        confirmText: 'Değiştir ve başlat'
      })
      if (!ok) return
    }
    sw.set({ running: true, startedAt: Date.now(), acc: 0, laps: [] })
    at.start(date, task.id)
  }

  const removeTask = async (task: PlanTask): Promise<void> => {
    if (
      !(await confirm({
        title: 'Görev silinsin mi?',
        message: task.title,
        confirmText: 'Sil',
        danger: true
      }))
    )
      return
    if (useActiveTask.getState().taskId === task.id) useActiveTask.getState().clear()
    deletePlanTask(date, task.id)
  }

  const undo = (task: PlanTask): void => {
    reopenPlanTask(date, task.id)
    toast('Görev yeniden açıldı' + (task.sessionId ? ', çalışma kaydı silindi' : ''), 'info')
  }

  return (
    <aside className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 pt-1">
        <div className="flex h-9 items-center justify-between">
          <h2 className="text-sm font-medium text-text">{isToday ? 'Bugünün planı' : 'Günün planı'}</h2>
          {tasks.length > 0 && (
            <span className="tabular text-sm text-muted">
              {done}/{tasks.length}
            </span>
          )}
        </div>
        {tasks.length > 0 && (
          <>
            <div className="mt-2 h-px w-full bg-border/70">
              <div className="h-px bg-text/70 transition-[width] duration-500" style={{ width: `${(done / tasks.length) * 100}%` }} />
            </div>
            {(totalMin > 0 || doneMin > 0) && (
              <div className="mt-3 text-xs text-muted">
                {totalMin > 0 && `Hedef ${formatMinutes(totalMin)}`}
                {doneMin > 0 && ` · ${formatMinutes(doneMin)} tamamlandı`}
              </div>
            )}
          </>
        )}
        {plan?.summary && (
          <p className="mt-3 flex gap-2 text-xs leading-relaxed text-muted">
            <Sparkles size={12} className="mt-0.5 shrink-0" />
            <span>{plan.summary}</span>
          </p>
        )}
      </div>

      {tasks.length === 0 ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center pb-16 text-center">
          <h3 className="text-base font-medium text-text">{isToday ? 'Bugün için plan yok' : 'Bu gün için plan yok'}</h3>
          <p className="mt-2 max-w-[300px] text-sm leading-relaxed text-muted">
            AI Koç eksik konularına ve hedeflerine göre sana bir gün planı çıkarabilir ya da kendin görev ekleyebilirsin.
          </p>
          <div className="mt-6 flex flex-col items-center gap-2">
            <Btn variant="main" onClick={() => go('ai', { prompt: 'plan' })}>
              <Sparkles size={14} className="mr-1.5" /> AI Koç ile plan oluştur
            </Btn>
            <button className="h-9 rounded-full px-4 text-sm text-muted transition hover:text-text" onClick={() => setForm({})}>
              Kendim oluşturacağım
            </button>
          </div>
        </div>
      ) : (
        <div className="-mr-3 mt-1 min-h-0 flex-1 overflow-y-auto pr-3">
          {tasks.map((t, i) => (
            <TaskRow
              key={t.id}
              task={t}
              index={i}
              count={tasks.length}
              active={activeId === t.id && !t.done}
              onStart={() => void startTask(t)}
              onFinish={() => setFinishing(t)}
              onEdit={() => setForm({ task: t })}
              onDelete={() => void removeTask(t)}
              onUndo={() => undo(t)}
              onMove={(d) => movePlanTask(date, t.id, d)}
            />
          ))}
          <button className="mt-3 flex h-9 items-center gap-1.5 rounded-full text-sm text-muted transition hover:text-text" onClick={() => setForm({})}>
            <Plus size={15} /> Görev ekle
          </button>
        </div>
      )}

      {form && <TaskForm date={date} task={form.task} onClose={() => setForm(null)} />}
      {finishing && <CompleteModal date={date} task={finishing} onClose={() => setFinishing(null)} />}
    </aside>
  )
}
