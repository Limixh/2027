// Çalışma Odası araçları: saat, geri sayım, kronometre, pomodoro, YKS sayacı, günün ilerlemesi.
import { CalendarClock, ChevronLeft, ChevronRight, Clock, Hourglass, ListChecks, Timer, Watch, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/components/ui'
import { beep, fmtSw, fmtTimer, swElapsed, useCountdownTimer, useStopwatch, useTicker } from '@/lib/clocks'
import { diffDays, formatDate, formatMinutes, pad, todayKey, weekdayName } from '@/lib/date'
import { useStore } from '@/lib/store'
import { Pill } from './parts'
import { useActiveTask, usePomodoro, type WidgetType } from './stores'

function notify(title: string, body: string): void {
  try {
    new Notification(title, { body })
  } catch {
    /* bildirim izni yok */
  }
}

interface ShellProps {
  title: string
  big?: boolean
  canLeft: boolean
  canRight: boolean
  onMove(dir: -1 | 1): void
  onRemove(): void
  children: React.ReactNode
}

export function WidgetShell({ title, big, canLeft, canRight, onMove, onRemove, children }: ShellProps): React.JSX.Element {
  return (
    <div className={cn('glass group relative flex min-h-0 flex-col overflow-hidden rounded-[28px] p-5', big && 'col-span-2 min-[1360px]:col-span-2')}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">{title}</span>
        <div className="-mr-1.5 -mt-1 flex items-center opacity-0 transition focus-within:opacity-100 group-hover:opacity-100">
          <button className="grid h-6 w-6 place-items-center rounded-full text-muted hover:bg-text/10 hover:text-text disabled:opacity-25" disabled={!canLeft} onClick={() => onMove(-1)} aria-label="Öne al" title="Öne al">
            <ChevronLeft size={15} />
          </button>
          <button className="grid h-6 w-6 place-items-center rounded-full text-muted hover:bg-text/10 hover:text-text disabled:opacity-25" disabled={!canRight} onClick={() => onMove(1)} aria-label="Sona al" title="Sona al">
            <ChevronRight size={15} />
          </button>
          <button className="grid h-6 w-6 place-items-center rounded-full text-muted hover:bg-danger/15 hover:text-danger" onClick={onRemove} aria-label="Kaldır" title="Kaldır">
            <X size={14} />
          </button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center">{children}</div>
    </div>
  )
}

/* ---------- Saat ---------- */

function ClockWidget({ big }: { big: boolean }): React.JSX.Element {
  useTicker(true, 1000)
  const now = new Date()
  const key = todayKey()
  return (
    <div className="text-center">
      <div className={cn('tabular font-extralight leading-none tracking-tight text-text', big ? 'text-[clamp(72px,9.5vw,140px)]' : 'text-6xl')}>
        {pad(now.getHours())}:{pad(now.getMinutes())}
        <span className={cn('ml-2 align-baseline font-light text-muted', big ? 'text-[0.3em]' : 'text-[0.4em]')}>{pad(now.getSeconds())}</span>
      </div>
      <div className="mt-3 text-sm text-muted">
        {formatDate(key)} · {weekdayName(key)}
      </div>
    </div>
  )
}

/* ---------- Geri sayım / Zamanlayıcı ---------- */

const PRESETS = [25, 50, 90]

function TimerWidget(): React.JSX.Element {
  const tm = useCountdownTimer()
  const running = !!tm.endsAt
  const idle = !running && tm.remaining === undefined
  useTicker(running, 200)
  const left = running ? Math.max(0, tm.endsAt! - Date.now()) : (tm.remaining ?? tm.total)
  const [custom, setCustom] = useState('')

  useEffect(() => {
    if (running && left <= 0) {
      tm.set({ endsAt: undefined, remaining: undefined, done: true })
      beep()
      notify('Süre doldu', 'Zamanlayıcı tamamlandı.')
    }
  }, [running, left, tm])

  const applyCustom = (): void => {
    const n = Math.round(Number(custom))
    if (n > 0 && n < 1000) tm.set({ total: n * 60000, done: false })
    setCustom('')
  }
  const frac = idle ? 1 : tm.total > 0 ? left / tm.total : 0

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div className={cn('tabular text-[56px] font-extralight leading-none tracking-tight', tm.done && idle ? 'text-success' : 'text-text')}>{fmtTimer(left)}</div>
      {idle ? (
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {PRESETS.map((p) => (
            <Pill key={p} size="sm" className={cn(tm.total === p * 60000 && 'bg-accent/45 hover:bg-accent/55')} onClick={() => tm.set({ total: p * 60000, done: false })}>
              {p} dk
            </Pill>
          ))}
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value.replace(/\D/g, '').slice(0, 3))}
            onKeyDown={(e) => e.key === 'Enter' && applyCustom()}
            onBlur={applyCustom}
            placeholder="özel"
            inputMode="numeric"
            className="h-8 w-16 rounded-full border border-text/15 bg-text/[0.06] text-center text-xs text-text outline-none placeholder:text-muted focus:border-accent"
            aria-label="Özel süre (dakika)"
          />
        </div>
      ) : (
        <div className="h-1 w-40 overflow-hidden rounded-full bg-text/15">
          <div className="h-full rounded-full bg-warning transition-[width] duration-200" style={{ width: `${frac * 100}%` }} />
        </div>
      )}
      <div className="flex items-center gap-2">
        {!idle && (
          <Pill size="sm" onClick={() => tm.set({ endsAt: undefined, remaining: undefined, done: false })}>
            İptal
          </Pill>
        )}
        {running ? (
          <Pill tone="stop" size="sm" onClick={() => tm.set({ endsAt: undefined, remaining: left })}>
            Duraklat
          </Pill>
        ) : (
          <Pill tone="go" size="sm" onClick={() => tm.set({ endsAt: Date.now() + left, remaining: undefined, done: false })}>
            {idle ? 'Başlat' : 'Devam'}
          </Pill>
        )}
      </div>
    </div>
  )
}

/* ---------- Kronometre ---------- */

function StopwatchWidget(): React.JSX.Element {
  const sw = useStopwatch()
  useTicker(sw.running)
  const elapsed = swElapsed(sw)
  const activeId = useActiveTask((s) => s.taskId)
  const activeDate = useActiveTask((s) => s.date)
  const plans = useStore((s) => s.data.plans)
  const activeTitle = activeId && activeDate ? plans[activeDate]?.tasks.find((t) => t.id === activeId)?.title : undefined

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div className="tabular text-[44px] font-extralight leading-none tracking-tight text-text">{fmtSw(elapsed)}</div>
      {activeTitle && <div className="max-w-full truncate text-xs text-muted">Aktif görev: {activeTitle}</div>}
      <div className="flex items-center gap-2">
        <Pill
          size="sm"
          disabled={sw.running || elapsed === 0}
          onClick={() => {
            sw.set({ running: false, startedAt: undefined, acc: 0, laps: [] })
            if (activeId) useActiveTask.getState().clear()
          }}
        >
          Sıfırla
        </Pill>
        {sw.running ? (
          <Pill tone="stop" size="sm" onClick={() => sw.set({ running: false, startedAt: undefined, acc: elapsed })}>
            Durdur
          </Pill>
        ) : (
          <Pill tone="go" size="sm" onClick={() => sw.set({ running: true, startedAt: Date.now() })}>
            {elapsed ? 'Devam' : 'Başlat'}
          </Pill>
        )}
      </div>
    </div>
  )
}

/* ---------- Pomodoro ---------- */

function PomodoroWidget(): React.JSX.Element {
  const pomo = usePomodoro()
  const work = useStore((s) => s.data.settings.pomodoroMinutes)
  const brk = useStore((s) => s.data.settings.breakMinutes)
  const running = !!pomo.endsAt
  const idle = !running && pomo.remaining === undefined
  useTicker(running, 250)
  const total = (pomo.phase === 'work' ? work : brk) * 60000
  const left = running ? Math.max(0, pomo.endsAt! - Date.now()) : (pomo.remaining ?? total)

  useEffect(() => {
    if (running && left <= 0) {
      const wasWork = pomo.phase === 'work'
      pomo.set({ endsAt: undefined, remaining: undefined, phase: wasWork ? 'break' : 'work', cycles: pomo.cycles + (wasWork ? 1 : 0) })
      beep()
      notify(wasWork ? 'Mola zamanı' : 'Odaklanma zamanı', wasWork ? 'Odaklanma turu tamamlandı.' : 'Mola bitti, devam edelim.')
    }
  }, [running, left, pomo])

  const size = 132
  const r = size / 2 - 5
  const c = 2 * Math.PI * r
  const frac = total > 0 ? left / total : 0
  const color = pomo.phase === 'work' ? 'rgb(var(--accent))' : 'rgb(var(--success))'

  return (
    <div className="flex w-full items-center justify-center gap-5">
      <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" className="text-text/15" strokeWidth={5} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={5}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - (idle ? 1 : frac))}
            style={{ transition: 'stroke-dashoffset .25s linear' }}
          />
        </svg>
        <div className="absolute text-center">
          <div className="tabular text-[28px] font-extralight leading-none text-text">{fmtTimer(left)}</div>
          <div className="mt-1 text-[11px] font-medium text-muted">{pomo.phase === 'work' ? 'Odaklanma' : 'Mola'}</div>
        </div>
      </div>
      <div className="flex flex-col items-start gap-2.5">
        <div className="flex items-center gap-1" title={`${pomo.cycles} tur tamamlandı`}>
          {Array.from({ length: Math.max(4, Math.min(8, pomo.cycles + 1)) }).map((_, i) => (
            <span key={i} className={cn('h-2 w-2 rounded-full', i < pomo.cycles ? 'bg-accent' : 'bg-text/20')} />
          ))}
        </div>
        <div className="text-xs text-muted">
          {work} dk odak · {brk} dk mola
        </div>
        <div className="flex gap-1.5">
          {running ? (
            <Pill tone="stop" size="sm" onClick={() => pomo.set({ endsAt: undefined, remaining: left })}>
              Duraklat
            </Pill>
          ) : (
            <Pill tone="go" size="sm" onClick={() => pomo.set({ endsAt: Date.now() + left, remaining: undefined })}>
              {idle ? 'Başlat' : 'Devam'}
            </Pill>
          )}
          <Pill size="sm" onClick={() => pomo.set({ endsAt: undefined, remaining: undefined, phase: pomo.phase === 'work' ? 'break' : 'work' })}>
            Atla
          </Pill>
          {(!idle || pomo.cycles > 0 || pomo.phase === 'break') && (
            <Pill size="sm" onClick={() => pomo.set({ endsAt: undefined, remaining: undefined, phase: 'work', cycles: 0 })}>
              Sıfırla
            </Pill>
          )}
        </div>
      </div>
    </div>
  )
}

/* ---------- YKS'ye kalan ---------- */

function ExamWidget(): React.JSX.Element {
  const examDate = useStore((s) => s.data.settings.examDate)
  const days = diffDays(todayKey(), examDate)
  return (
    <div className="text-center">
      {days > 0 ? (
        <>
          <div className="tabular text-[76px] font-extralight leading-none tracking-tight text-text">
            {days}
            <span className="ml-2 text-lg font-light text-muted">gün</span>
          </div>
          <div className="mt-3 text-sm text-muted">
            {Math.floor(days / 7)} hafta {days % 7} gün · {formatDate(examDate)}
          </div>
        </>
      ) : days === 0 ? (
        <div className="text-4xl font-light text-text">Sınav günü</div>
      ) : (
        <div className="text-lg text-muted">Sınav tarihi geçti</div>
      )}
    </div>
  )
}

/* ---------- Bugünün ilerlemesi ---------- */

function ProgressWidget(): React.JSX.Element {
  const key = todayKey()
  const plan = useStore((s) => s.data.plans[key])
  const sessions = useStore((s) => s.data.sessions)
  const goal = useStore((s) => s.data.settings.dailyGoalMinutes)
  const minutes = useMemo(() => sessions.filter((x) => x.date === key).reduce((a, x) => a + x.minutes, 0), [sessions, key])
  const total = plan?.tasks.length ?? 0
  const done = plan?.tasks.filter((t) => t.done).length ?? 0
  const frac = total ? done / total : 0
  const goalFrac = goal > 0 ? Math.min(1, minutes / goal) : 0

  const size = 96
  const r = size / 2 - 5
  const c = 2 * Math.PI * r

  return (
    <div className="flex w-full items-center justify-center gap-5">
      <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" className="text-text/15" strokeWidth={6} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--success))" strokeWidth={6} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} style={{ transition: 'stroke-dashoffset .5s' }} />
        </svg>
        <div className="absolute text-center">
          <div className="tabular text-2xl font-light leading-none text-text">
            {done}
            <span className="text-muted">/{total}</span>
          </div>
          <div className="mt-0.5 text-[10px] text-muted">görev</div>
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted">Bugün çalışılan</div>
        <div className="tabular text-xl font-light text-text">{formatMinutes(minutes)}</div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-text/15">
          <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${goalFrac * 100}%` }} />
        </div>
        <div className="mt-1.5 text-xs text-muted">Günlük hedef {formatMinutes(goal)}</div>
        {total === 0 && <div className="mt-1 text-xs text-muted">Bugün için plan yok</div>}
      </div>
    </div>
  )
}

/* ---------- Kayıt ---------- */

export const WIDGET_INFO: Record<WidgetType, { label: string; desc: string; icon: React.ComponentType<{ size?: number }> }> = {
  clock: { label: 'Saat', desc: 'Anlık saat ve tarih', icon: Clock },
  timer: { label: 'Geri sayım', desc: 'Zamanlayıcı, hazır süreler', icon: Hourglass },
  stopwatch: { label: 'Kronometre', desc: 'Başlat, durdur, sıfırla', icon: Watch },
  pomodoro: { label: 'Pomodoro', desc: 'Odaklanma ve mola döngüsü', icon: Timer },
  exam: { label: 'YKS’ye kalan', desc: 'Sınava kalan gün sayısı', icon: CalendarClock },
  progress: { label: 'Bugünün ilerlemesi', desc: 'Görevler ve çalışma süresi', icon: ListChecks }
}

export function WidgetBody({ type, big }: { type: WidgetType; big: boolean }): React.JSX.Element {
  switch (type) {
    case 'clock':
      return <ClockWidget big={big} />
    case 'timer':
      return <TimerWidget />
    case 'stopwatch':
      return <StopwatchWidget />
    case 'pomodoro':
      return <PomodoroWidget />
    case 'exam':
      return <ExamWidget />
    case 'progress':
      return <ProgressWidget />
  }
}
