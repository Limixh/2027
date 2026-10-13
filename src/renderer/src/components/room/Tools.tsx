// Çalışma Odası aracı: tek seferde tek büyük araç, sayfa zemininde ince rakamlarla.
import { useEffect, useState } from 'react'
import { cn } from '@/components/ui'
import { beep, fmtSw, fmtTimer, swElapsed, useCountdownTimer, useStopwatch, useTicker } from '@/lib/clocks'
import { diffDays, formatDate, pad, todayKey, weekdayName } from '@/lib/date'
import { useStore } from '@/lib/store'
import { useActiveTask, type ToolType } from './stores'

function notify(title: string, body: string): void {
  try {
    new Notification(title, { body })
  } catch {
    /* bildirim izni yok */
  }
}

/** Sade düğme: `main` dolu nötr, `quiet` yalnızca yazı */
export function Btn({ variant = 'quiet', className, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'main' | 'quiet' }): React.JSX.Element {
  return (
    <button
      className={cn(
        'inline-flex h-10 min-w-[104px] items-center justify-center whitespace-nowrap rounded-full px-6 text-sm font-medium transition active:scale-[0.97] disabled:pointer-events-none disabled:opacity-35',
        variant === 'main' ? 'bg-text text-bg hover:opacity-85' : 'bg-text/[0.07] text-text hover:bg-text/[0.12]',
        className
      )}
      {...rest}
    />
  )
}

const digits = 'tabular font-extralight leading-none tracking-tight text-text'

/* ---------- Saat ---------- */

function ClockTool(): React.JSX.Element {
  useTicker(true, 1000)
  const now = new Date()
  const key = todayKey()
  return (
    <>
      <div className={cn(digits, 'text-[clamp(88px,12vw,200px)]')}>
        {pad(now.getHours())}:{pad(now.getMinutes())}
        <span className="ml-[0.12em] align-baseline text-[0.28em] font-extralight text-muted">{pad(now.getSeconds())}</span>
      </div>
      <div className="mt-8 text-[15px] text-muted">
        {formatDate(key)} · {weekdayName(key)}
      </div>
    </>
  )
}

/* ---------- Geri sayım ---------- */

const PRESETS = [25, 50, 90]

function TimerTool(): React.JSX.Element {
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
    <>
      <div className={cn(digits, 'text-[clamp(88px,12vw,200px)]', tm.done && idle && 'text-success')}>{fmtTimer(left)}</div>
      <div className="mt-8 flex h-8 items-center">
        {idle ? (
          <div className="flex items-center gap-1">
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => tm.set({ total: p * 60000, done: false })}
                className={cn('h-8 rounded-full px-3.5 text-sm transition', tm.total === p * 60000 ? 'bg-text/[0.09] font-medium text-text' : 'text-muted hover:text-text')}
              >
                {p} dk
              </button>
            ))}
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value.replace(/\D/g, '').slice(0, 3))}
              onKeyDown={(e) => e.key === 'Enter' && applyCustom()}
              onBlur={applyCustom}
              placeholder="özel"
              inputMode="numeric"
              aria-label="Özel süre (dakika)"
              className="ml-1 h-8 w-16 border-b border-border bg-transparent text-center text-sm text-text outline-none placeholder:text-muted focus:border-text"
            />
          </div>
        ) : (
          <div className="h-px w-56 bg-border/70">
            <div className="h-px bg-text/70 transition-[width] duration-200" style={{ width: `${frac * 100}%` }} />
          </div>
        )}
      </div>
      <div className="mt-8 flex items-center gap-3">
        {!idle && <Btn onClick={() => tm.set({ endsAt: undefined, remaining: undefined, done: false })}>İptal</Btn>}
        {running ? (
          <Btn variant="main" onClick={() => tm.set({ endsAt: undefined, remaining: left })}>
            Duraklat
          </Btn>
        ) : (
          <Btn variant="main" onClick={() => tm.set({ endsAt: Date.now() + left, remaining: undefined, done: false })}>
            {idle ? 'Başlat' : 'Devam'}
          </Btn>
        )}
      </div>
    </>
  )
}

/* ---------- Kronometre ---------- */

function StopwatchTool(): React.JSX.Element {
  const sw = useStopwatch()
  useTicker(sw.running)
  const elapsed = swElapsed(sw)
  const activeId = useActiveTask((s) => s.taskId)
  const activeDate = useActiveTask((s) => s.date)
  const plans = useStore((s) => s.data.plans)
  const activeTitle = activeId && activeDate ? plans[activeDate]?.tasks.find((t) => t.id === activeId)?.title : undefined

  return (
    <>
      <div className={cn(digits, 'text-[clamp(72px,10vw,176px)]')}>{fmtSw(elapsed)}</div>
      <div className="mt-8 flex h-6 max-w-full items-center px-4 text-[15px] text-muted">
        {activeTitle && (
          <span className="truncate">
            Aktif görev: <span className="text-text">{activeTitle}</span>
          </span>
        )}
      </div>
      <div className="mt-8 flex items-center gap-3">
        <Btn
          disabled={sw.running || elapsed === 0}
          onClick={() => {
            sw.set({ running: false, startedAt: undefined, acc: 0, laps: [] })
            if (activeId) useActiveTask.getState().clear()
          }}
        >
          Sıfırla
        </Btn>
        {sw.running ? (
          <Btn variant="main" onClick={() => sw.set({ running: false, startedAt: undefined, acc: elapsed })}>
            Durdur
          </Btn>
        ) : (
          <Btn variant="main" onClick={() => sw.set({ running: true, startedAt: Date.now() })}>
            {elapsed ? 'Devam' : 'Başlat'}
          </Btn>
        )}
      </div>
    </>
  )
}

/* ---------- YKS'ye kalan ---------- */

function ExamTool(): React.JSX.Element {
  const examDate = useStore((s) => s.data.settings.examDate)
  const days = diffDays(todayKey(), examDate)
  if (days > 0)
    return (
      <>
        <div className={cn(digits, 'text-[clamp(110px,15vw,240px)]')}>{days}</div>
        <div className="mt-8 text-lg font-light text-text">gün kaldı</div>
        <div className="mt-2 text-[15px] text-muted">
          {Math.floor(days / 7)} hafta {days % 7} gün · {formatDate(examDate)}
        </div>
      </>
    )
  return <div className={cn(digits, 'text-[clamp(56px,7vw,110px)]')}>{days === 0 ? 'Sınav günü' : 'Sınav tarihi geçti'}</div>
}

export function ToolBody({ tool }: { tool: ToolType }): React.JSX.Element {
  switch (tool) {
    case 'clock':
      return <ClockTool />
    case 'timer':
      return <TimerTool />
    case 'stopwatch':
      return <StopwatchTool />
    case 'exam':
      return <ExamTool />
  }
}
