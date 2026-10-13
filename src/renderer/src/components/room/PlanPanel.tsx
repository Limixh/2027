// Günün planı: görev listesi, başlat / bitti akışı, ekleme ve düzenleme.
import { ArrowDown, ArrowUp, Check, ClipboardList, Clock3, Pause, Pencil, Play, Plus, Sparkles, Trash2, Undo2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { PlanTask } from '../../../../shared/types'
import { SUBJECT_MAP, TOPIC_MAP } from '@/data/curriculum'
import { cn, confirm, toast } from '@/components/ui'
import { swElapsed, useStopwatch, useTicker } from '@/lib/clocks'
import { formatMinutes } from '@/lib/date'
import { useNav } from '@/lib/nav'
import { useStore } from '@/lib/store'
import CompleteModal from './CompleteModal'
import { KIND_COLOR, KIND_LABEL, fmtHMS } from './meta'
import { IconBtn, Pill } from './parts'
import { useActiveTask } from './stores'
import TaskForm from './TaskForm'

function ActiveBar(): React.JSX.Element {
  const sw = useStopwatch()
  useTicker(sw.running, 500)
  return (
    <div className="mt-2.5 flex items-center gap-2 rounded-xl bg-accent/20 px-3 py-2">
      <span className={cn('h-2 w-2 rounded-full bg-accent', sw.running && 'animate-pulse')} />
      <span className="text-xs font-semibold text-text">Aktif görev</span>
      <span className="tabular ml-auto text-sm font-medium text-text">{fmtHMS(swElapsed(sw))}</span>
      <IconBtn
        className="h-6 w-6 text-text"
        aria-label={sw.running ? 'Duraklat' : 'Devam'}
        title={sw.running ? 'Duraklat' : 'Devam'}
        onClick={() => (sw.running ? sw.set({ running: false, startedAt: undefined, acc: swElapsed(sw) }) : sw.set({ running: true, startedAt: Date.now() }))}
      >
        {sw.running ? <Pause size={13} /> : <Play size={13} />}
      </IconBtn>
    </div>
  )
}

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
  const color = KIND_COLOR[task.kind]

  return (
    <div
      className={cn(
        'group rounded-2xl border px-3.5 py-3 transition',
        active ? 'border-accent/70 bg-accent/15 shadow-[0_0_0_1px_rgb(var(--accent)/0.35)]' : 'border-text/10 bg-text/[0.05] hover:bg-text/[0.08]',
        task.done && 'opacity-70'
      )}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={task.done ? onUndo : onFinish}
          className={cn(
            'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition',
            task.done ? 'border-success bg-success text-white' : 'border-text/35 text-transparent hover:border-success hover:text-success'
          )}
          aria-label={task.done ? 'Geri al' : 'Bitti olarak işaretle'}
          title={task.done ? 'Geri al' : 'Bitti'}
        >
          <Check size={12} strokeWidth={3} />
        </button>
        <div className="min-w-0 flex-1">
          <div className={cn('text-[15px] font-medium leading-snug text-text', task.done && 'text-muted line-through decoration-text/40')}>{task.title}</div>
          {(subject || topic) && (
            <div className="mt-1 flex items-center gap-1.5 text-xs text-muted">
              {subject && <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: subject.color }} />}
              <span className="truncate">
                {subject?.short}
                {topic && ` · ${topic.name}`}
              </span>
            </div>
          )}
          {task.scope && <div className="mt-0.5 text-xs text-muted">{task.scope}</div>}
          <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted">
            <span className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold" style={{ backgroundColor: color + '26', color }}>
              {KIND_LABEL[task.kind]}
            </span>
            {task.targetMinutes ? (
              <span className="inline-flex items-center gap-1">
                <Clock3 size={12} /> {task.targetMinutes} dk
              </span>
            ) : null}
            {task.targetQuestions ? (
              <span className="inline-flex items-center gap-1">
                <Pencil size={11} /> {task.targetQuestions} soru
              </span>
            ) : null}
            {task.time && <span className="tabular font-medium text-text/80">{task.time}</span>}
            {task.source === 'ai' && (
              <span className="ml-auto text-accent" title="AI Koç önerisi">
                <Sparkles size={13} />
              </span>
            )}
          </div>
          {active && !task.done && <ActiveBar />}
          <div className="mt-2.5 flex items-center gap-1.5">
            {task.done ? (
              <Pill size="sm" onClick={onUndo}>
                <Undo2 size={13} /> Geri al
              </Pill>
            ) : (
              <>
                {!active && (
                  <Pill size="sm" onClick={onStart}>
                    <Play size={12} /> Başlat
                  </Pill>
                )}
                <Pill size="sm" tone={active ? 'primary' : 'go'} onClick={onFinish}>
                  <Check size={13} /> Bitti
                </Pill>
              </>
            )}
            <div className="ml-auto flex items-center opacity-0 transition focus-within:opacity-100 group-hover:opacity-100">
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
    if (!(await confirm({ title: 'Görev silinsin mi?', message: task.title, confirmText: 'Sil', danger: true }))) return
    if (useActiveTask.getState().taskId === task.id) useActiveTask.getState().clear()
    deletePlanTask(date, task.id)
  }

  const undo = (task: PlanTask): void => {
    reopenPlanTask(date, task.id)
    toast('Görev yeniden açıldı' + (task.sessionId ? ', çalışma kaydı silindi' : ''), 'info')
  }

  return (
    <aside className="glass flex h-full min-h-0 flex-col rounded-[28px]">
      <div className="shrink-0 px-5 pb-3 pt-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-text">{isToday ? 'Bugünün planı' : 'Günün planı'}</h2>
          {tasks.length > 0 && (
            <span className="tabular text-sm font-medium text-text">
              {done}
              <span className="text-muted">/{tasks.length}</span>
            </span>
          )}
        </div>
        {tasks.length > 0 && (
          <>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-text/15">
              <div className="h-full rounded-full bg-success transition-[width] duration-500" style={{ width: `${(done / tasks.length) * 100}%` }} />
            </div>
            <div className="mt-2 text-xs text-muted">
              {totalMin > 0 ? `Toplam hedef ${formatMinutes(totalMin)}` : 'Süre hedefi yok'}
              {doneMin > 0 && ` · ${formatMinutes(doneMin)} tamamlandı`}
            </div>
          </>
        )}
        {plan?.summary && (
          <div className="mt-3 flex gap-2 rounded-2xl bg-accent/15 px-3 py-2.5 text-xs leading-relaxed text-text">
            <Sparkles size={13} className="mt-0.5 shrink-0 text-accent" />
            <span>{plan.summary}</span>
          </div>
        )}
      </div>

      {tasks.length === 0 ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-8 pb-8 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-text/10 text-text">
            <ClipboardList size={24} />
          </div>
          <h3 className="mt-4 text-base font-semibold text-text">{isToday ? 'Bugün için plan yok' : 'Bu gün için plan yok'}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">AI Koç eksik konularına ve hedeflerine göre sana bir gün planı çıkarabilir ya da kendin görev ekleyebilirsin.</p>
          <div className="mt-5 flex w-full flex-col gap-2">
            <Pill tone="primary" onClick={() => go('ai', { prompt: 'plan' })}>
              <Sparkles size={15} /> AI Koç ile plan oluştur
            </Pill>
            <Pill onClick={() => setForm({})}>Kendim oluşturacağım</Pill>
          </div>
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 pb-3 pt-1">
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
          </div>
          <div className="shrink-0 border-t border-text/10 p-3">
            <button
              className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl text-sm font-medium text-text transition hover:bg-text/10"
              onClick={() => setForm({})}
            >
              <Plus size={15} /> Görev ekle
            </button>
          </div>
        </>
      )}

      {form && <TaskForm date={date} task={form.task} onClose={() => setForm(null)} />}
      {finishing && <CompleteModal date={date} task={finishing} onClose={() => setFinishing(null)} />}
    </aside>
  )
}

