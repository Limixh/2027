import { Check, Coffee, Pause, Play, RotateCcw, Save, Timer as TimerIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button, Card, CardHeader, cn, Field, ProgressRing, Segmented, toast } from '@/components/ui'
import { formatMinutes, todayKey } from '@/lib/date'
import { useStore } from '@/lib/store'
import { elapsedMs, fmtClock, useTimer, type TimerMode } from '@/lib/timer'
import { subjectColor } from './meta'
import type { SessionDefaults } from './SessionForm'
import { SubjectSelect, TopicSelect } from './SubjectSelect'

/** Pomodoro bittiğinde kısa bir üçlü bip */
function beep(): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    ;[0, 0.28, 0.56].forEach((t, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = i === 2 ? 1046 : 784
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + t)
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.22)
      osc.connect(gain).connect(ctx.destination)
      osc.start(ctx.currentTime + t)
      osc.stop(ctx.currentTime + t + 0.25)
    })
    setTimeout(() => void ctx.close(), 1200)
  } catch {
    /* ses desteklenmiyor */
  }
}

export function TimerPanel({ onDetailed }: { onDetailed: (d: SessionDefaults) => void }): React.JSX.Element {
  const timer = useTimer()
  const settings = useStore((s) => s.data.settings)
  const addSession = useStore((s) => s.addSession)
  const [, setNow] = useState(0)

  // Boştayken hedefi ayarlardaki pomodoro süresiyle eşitle
  useEffect(() => {
    const t = useTimer.getState()
    if (!t.running && t.accumulated === 0 && !t.onBreak) t.setTarget(settings.pomodoroMinutes)
  }, [settings.pomodoroMinutes])

  // Yalnızca çalışırken tik at; süre dolunca otomatik duraklat
  useEffect(() => {
    if (!timer.running) return
    const id = setInterval(() => {
      setNow(Date.now())
      const t = useTimer.getState()
      if (t.mode !== 'pomodoro' || !t.running) return
      if (elapsedMs(t) >= t.targetMinutes * 60000) {
        t.pause()
        beep()
        if (t.onBreak) {
          toast('Mola bitti, yeni pomodoroya hazırsın', 'info')
          const s = useStore.getState().data.settings
          useTimer.getState().reset()
          useTimer.getState().setBreak(false)
          useTimer.getState().setTarget(s.pomodoroMinutes)
        } else {
          toast('Pomodoro tamamlandı! Süreyi kaydedebilirsin', 'success')
        }
      }
    }, 250)
    return () => clearInterval(id)
  }, [timer.running])

  const ms = elapsedMs(timer)
  const targetMs = timer.targetMinutes * 60000
  const isPomo = timer.mode === 'pomodoro'
  const finished = isPomo && !timer.running && ms >= targetMs && targetMs > 0
  const idle = !timer.running && ms === 0
  const accent = timer.onBreak ? 'rgb(var(--success))' : timer.subjectId ? subjectColor(timer.subjectId) : undefined

  const shownMs = isPomo ? Math.max(0, targetMs - ms) : ms
  const progress = isPomo ? (targetMs ? ms / targetMs : 0) : (ms % 3600000) / 3600000

  const minutesToSave = Math.max(1, Math.round(ms / 60000))
  const canSave = !timer.onBreak && ms >= 30000

  const save = (detailed = false): void => {
    timer.pause()
    const t = useTimer.getState()
    if (detailed) {
      onDetailed({ minutes: minutesToSave, subjectId: t.subjectId, topicId: t.topicId })
      useTimer.getState().reset()
      return
    }
    addSession({
      date: todayKey(),
      minutes: minutesToSave,
      subjectId: t.subjectId,
      topicId: t.topicId,
      kind: 'konu'
    })
    toast(`${formatMinutes(minutesToSave)} çalışma kaydedildi`)
    useTimer.getState().reset()
  }

  const startBreak = (): void => {
    const t = useTimer.getState()
    t.reset()
    t.setBreak(true)
    t.setTarget(settings.breakMinutes)
    useTimer.getState().start()
  }

  const endBreak = (): void => {
    const t = useTimer.getState()
    t.reset()
    t.setBreak(false)
    t.setTarget(settings.pomodoroMinutes)
  }

  const changeMode = (m: TimerMode): void => {
    timer.setMode(m)
  }

  const presets = Array.from(new Set([25, 50, 90, settings.pomodoroMinutes])).sort((a, b) => a - b)

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        icon={timer.onBreak ? <Coffee size={16} /> : <TimerIcon size={16} />}
        title={timer.onBreak ? 'Mola' : 'Zamanlayıcı'}
        subtitle={
          timer.onBreak ? `${settings.breakMinutes} dakikalık mola` : isPomo ? 'Pomodoro ile odaklan' : 'Serbest kronometre'
        }
        action={
          <div className={cn(!idle && 'pointer-events-none opacity-50')}>
            <Segmented
              size="sm"
              value={timer.mode}
              onChange={changeMode}
              options={[
                { value: 'pomodoro', label: 'Pomodoro' },
                { value: 'stopwatch', label: 'Kronometre' }
              ]}
            />
          </div>
        }
      />

      <div className="flex flex-1 flex-col items-center px-5 pb-5 pt-4">
        <ProgressRing
          value={finished ? 1 : progress}
          size={196}
          stroke={9}
          color={finished ? 'rgb(var(--success))' : accent}
        >
          <div className="text-center">
            {finished ? (
              <div className="flex flex-col items-center">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-success/15 text-success">
                  <Check size={22} />
                </span>
                <div className="mt-1.5 text-sm font-semibold text-success">Tamamlandı</div>
                <div className="tabular text-xs text-muted">{formatMinutes(ms / 60000)}</div>
              </div>
            ) : (
              <>
                <div className={cn('tabular text-[40px] font-semibold leading-none tracking-tight', timer.running ? 'text-text' : 'text-muted')}>
                  {fmtClock(shownMs)}
                </div>
                <div className="mt-2 text-[11px] font-medium uppercase tracking-wider text-subtle">
                  {timer.onBreak ? 'mola' : isPomo ? (timer.running ? 'odak' : idle ? `${timer.targetMinutes} dk hedef` : 'duraklatıldı') : timer.running ? 'çalışıyor' : idle ? 'hazır' : 'duraklatıldı'}
                </div>
              </>
            )}
          </div>
        </ProgressRing>

        {isPomo && idle && !timer.onBreak && (
          <div className="mt-3 flex gap-1.5">
            {presets.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => timer.setTarget(p)}
                className={cn(
                  'h-6 rounded-md px-2 text-[11px] font-medium tabular transition',
                  timer.targetMinutes === p ? 'bg-accent/15 text-accent' : 'bg-surface-2 text-muted hover:text-text'
                )}
              >
                {p} dk
              </button>
            ))}
          </div>
        )}

        {/* Ders / konu */}
        {!timer.onBreak && (
          <div className="mt-4 grid w-full grid-cols-2 gap-2.5">
            <Field label="Ders" className="min-w-0">
              <SubjectSelect value={timer.subjectId} placeholder="Ders (isteğe bağlı)" onChange={(v) => timer.setSubject(v, undefined)} />
            </Field>
            <Field label="Konu" className="min-w-0">
              <TopicSelect subjectId={timer.subjectId} value={timer.topicId} onChange={(v) => timer.setSubject(timer.subjectId, v)} />
            </Field>
          </div>
        )}

        {/* Kontroller */}
        <div className="mt-auto flex w-full flex-wrap items-center justify-center gap-2 pt-4">
          {finished && !timer.onBreak ? (
            <>
              <Button variant="primary" size="lg" icon={<Save size={16} />} onClick={() => save()}>
                Kaydet
              </Button>
              <Button variant="secondary" size="lg" icon={<Coffee size={16} />} onClick={startBreak}>
                {settings.breakMinutes} dk mola
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              size="lg"
              className="min-w-[132px] justify-center"
              icon={timer.running ? <Pause size={16} /> : <Play size={16} />}
              onClick={() => (timer.running ? timer.pause() : timer.start())}
            >
              {timer.running ? 'Duraklat' : idle ? 'Başlat' : 'Devam et'}
            </Button>
          )}
          {!finished && canSave && (
            <Button variant="secondary" size="lg" icon={<Save size={16} />} onClick={() => save()} title={`${formatMinutes(minutesToSave)} olarak kaydet`}>
              Kaydet
            </Button>
          )}
          {timer.onBreak ? (
            <Button variant="ghost" size="lg" onClick={endBreak}>
              Molayı atla
            </Button>
          ) : (
            !idle && (
              <Button variant="ghost" size="lg" icon={<RotateCcw size={15} />} onClick={() => timer.reset()} aria-label="Sıfırla" title="Sıfırla">
                Sıfırla
              </Button>
            )
          )}
        </div>
        {canSave && (
          <button type="button" className="mt-2 text-[11px] text-subtle underline-offset-2 hover:text-accent hover:underline" onClick={() => save(true)}>
            Soru sayısı / not ekleyerek kaydet
          </button>
        )}
      </div>
    </Card>
  )
}
