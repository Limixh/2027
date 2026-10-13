// Tam ekran sayaç: geri sayım listesi, kronometre ve zamanlayıcı.
// Kenar çubuğu olmadan tüm pencereyi kaplar; tam ekran (F11) desteklenir.
import { ArrowLeft, Bell, Flag, Maximize2, Minimize2, Plus, Save, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { create } from 'zustand'
import { cn, toast } from '@/components/ui'
import { formatDate, pad, todayKey } from '@/lib/date'
import { useNav } from '@/lib/nav'
import { useStore } from '@/lib/store'

type Tab = 'countdown' | 'stopwatch' | 'timer'

/* ---------- Kalıcı (sayfadan çıkınca da süren) durumlar ---------- */

interface StopwatchState {
  running: boolean
  startedAt?: number
  acc: number
  laps: number[]
  set(p: Partial<StopwatchState>): void
}
const useStopwatch = create<StopwatchState>((set) => ({ running: false, acc: 0, laps: [], set: (p) => set(p) }))

interface TimerState {
  /** Toplam süre (ms) */
  total: number
  /** Çalışırken bitiş anı */
  endsAt?: number
  /** Duraklatıldığında kalan (ms) */
  remaining?: number
  done: boolean
  set(p: Partial<TimerState>): void
}
const useCountdownTimer = create<TimerState>((set) => ({ total: 25 * 60000, done: false, set: (p) => set(p) }))

const swElapsed = (s: Pick<StopwatchState, 'running' | 'startedAt' | 'acc'>): number =>
  s.acc + (s.running && s.startedAt ? Date.now() - s.startedAt : 0)

/** Ekranı ~30 fps yeniler (yalnızca gerektiğinde) */
function useTicker(active: boolean, ms = 33): void {
  const [, setN] = useState(0)
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setN((n) => n + 1), ms)
    return () => clearInterval(id)
  }, [active, ms])
}

function beep(): void {
  try {
    const ctx = new AudioContext()
    ;[0, 0.35, 0.7].forEach((t) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.frequency.value = 880
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t)
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.3)
      o.connect(g).connect(ctx.destination)
      o.start(ctx.currentTime + t)
      o.stop(ctx.currentTime + t + 0.32)
    })
  } catch {
    /* ses yok */
  }
}

/* ---------- Ortak parçalar ---------- */

/** Apple tarzı yuvarlak düğme */
function RoundButton({
  children,
  onClick,
  tone = 'neutral',
  disabled
}: {
  children: React.ReactNode
  onClick: () => void
  tone?: 'neutral' | 'go' | 'stop'
  disabled?: boolean
}): React.JSX.Element {
  const tones = {
    neutral: 'bg-surface-3/70 text-text',
    go: 'bg-success/15 text-success',
    stop: 'bg-danger/15 text-danger'
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'grid h-[88px] w-[88px] place-items-center rounded-full text-[15px] font-medium outline outline-2 outline-offset-[3px] outline-transparent transition active:scale-95 disabled:opacity-40',
        tones[tone],
        tone === 'go' && 'outline-success/25',
        tone === 'stop' && 'outline-danger/25',
        tone === 'neutral' && 'outline-surface-3/60'
      )}
    >
      {children}
    </button>
  )
}

/** Büyük, ince rakamlar */
function BigNumber({ children, size = 'xl' }: { children: React.ReactNode; size?: 'xl' | 'lg' }): React.JSX.Element {
  return (
    <div
      className={cn(
        'tabular font-extralight leading-none tracking-tight text-text',
        size === 'xl' ? 'text-[clamp(64px,14vw,200px)]' : 'text-[clamp(48px,9vw,128px)]'
      )}
    >
      {children}
    </div>
  )
}

/* ---------- Geri sayım ---------- */

function parseLocal(at: string): Date {
  const [d, t = '00:00'] = at.split('T')
  const [y, m, day] = d.split('-').map(Number)
  const [hh, mm] = t.split(':').map(Number)
  return new Date(y, m - 1, day, hh, mm)
}

function splitDiff(ms: number): { d: number; h: number; m: number; s: number } {
  const t = Math.max(0, Math.floor(ms / 1000))
  return { d: Math.floor(t / 86400), h: Math.floor((t % 86400) / 3600), m: Math.floor((t % 3600) / 60), s: t % 60 }
}

function CountdownTab(): React.JSX.Element {
  const examDate = useStore((s) => s.data.settings.examDate)
  const countdowns = useStore((s) => s.data.countdowns)
  const addCountdown = useStore((s) => s.addCountdown)
  const deleteCountdown = useStore((s) => s.deleteCountdown)
  useTicker(true, 1000)

  // YKS her zaman listenin başında (TYT oturumu 10:15)
  const items = useMemo(
    () => [
      { id: 'yks', title: 'YKS 2027', at: `${examDate}T10:15`, fixed: true },
      ...countdowns.map((c) => ({ ...c, fixed: false }))
    ],
    [examDate, countdowns]
  )
  const [selected, setSelected] = useState('yks')
  const current = items.find((i) => i.id === selected) ?? items[0]
  const target = parseLocal(current.at)
  const diff = target.getTime() - Date.now()
  const { d, h, m, s } = splitDiff(diff)

  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(todayKey())
  const [time, setTime] = useState('10:00')

  return (
    <div className="grid h-full w-full grid-cols-1 gap-10 lg:grid-cols-[1fr_340px]">
      <div className="flex flex-col items-center justify-center text-center">
        <div className="mb-6 text-sm font-medium uppercase tracking-[0.25em] text-muted">{current.title}</div>
        {diff > 0 ? (
          <>
            <BigNumber>
              {d}
              <span className="ml-3 text-[0.28em] font-light text-muted">gün</span>
            </BigNumber>
            <div className="tabular mt-6 text-[clamp(28px,4.5vw,64px)] font-extralight tracking-tight text-text/90">
              {pad(h)}
              <span className="text-subtle">:</span>
              {pad(m)}
              <span className="text-subtle">:</span>
              {pad(s)}
            </div>
            <div className="mt-8 text-sm text-subtle">
              {formatDate(current.at.slice(0, 10))} · {current.at.slice(11, 16)}
              {current.fixed && ' · tahmini tarih, Ayarlar’dan değiştirilebilir'}
            </div>
          </>
        ) : (
          <BigNumber size="lg">Bugün 🎉</BigNumber>
        )}
      </div>

      {/* Liste */}
      <div className="flex min-h-0 flex-col justify-center">
        <div className="mb-3 flex items-center justify-between px-1">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-subtle">Geri sayımlar</span>
          <button className="text-subtle transition hover:text-text" onClick={() => setAdding((v) => !v)} aria-label="Ekle" title="Ekle">
            <Plus size={18} />
          </button>
        </div>
        {adding && (
          <div className="mb-3 space-y-2 rounded-2xl bg-surface-2/70 p-3">
            <input className="input" placeholder="Başlık (ör. Okul sınavı)" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
            <div className="flex gap-2">
              <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <input className="input w-28" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <button
              className="h-9 w-full rounded-lg bg-accent text-sm font-medium text-on-accent disabled:opacity-40"
              disabled={!title.trim() || !date}
              onClick={() => {
                addCountdown({ title: title.trim(), at: `${date}T${time || '00:00'}` })
                setTitle('')
                setAdding(false)
              }}
            >
              Ekle
            </button>
          </div>
        )}
        <div className="max-h-[60vh] space-y-1 overflow-y-auto">
          {items.map((it) => {
            const dd = splitDiff(parseLocal(it.at).getTime() - Date.now())
            const past = parseLocal(it.at).getTime() <= Date.now()
            return (
              <div
                key={it.id}
                onClick={() => setSelected(it.id)}
                className={cn(
                  'group flex cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 transition',
                  it.id === current.id ? 'bg-surface-2' : 'hover:bg-surface-2/50'
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-medium">{it.title}</div>
                  <div className="text-xs text-subtle">{formatDate(it.at.slice(0, 10))}</div>
                </div>
                <div className="tabular text-right text-xl font-light text-text/90">
                  {past ? '—' : `${dd.d} g`}
                </div>
                {!it.fixed && (
                  <button
                    className="text-subtle opacity-0 transition hover:text-danger group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteCountdown(it.id)
                      if (selected === it.id) setSelected('yks')
                    }}
                    aria-label="Sil"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ---------- Kronometre ---------- */

function fmtSw(ms: number): string {
  const cs = Math.floor((ms % 1000) / 10)
  const t = Math.floor(ms / 1000)
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = t % 60
  return `${h ? h + ':' + pad(m) : pad(m)}:${pad(s)},${pad(cs)}`
}

function StopwatchTab(): React.JSX.Element {
  const sw = useStopwatch()
  const addSession = useStore((s) => s.addSession)
  useTicker(sw.running)
  const elapsed = swElapsed(sw)

  // Tur süreleri (en yenisi üstte); devam eden tur dahil
  const lapTimes = useMemo(() => {
    const out: number[] = []
    let prev = 0
    for (const l of sw.laps) {
      out.push(l - prev)
      prev = l
    }
    return out
  }, [sw.laps])
  const currentLap = elapsed - (sw.laps[sw.laps.length - 1] ?? 0)
  const best = lapTimes.length > 1 ? Math.min(...lapTimes) : -1
  const worst = lapTimes.length > 1 ? Math.max(...lapTimes) : -1

  const start = (): void => sw.set({ running: true, startedAt: Date.now() })
  const stop = (): void => sw.set({ running: false, startedAt: undefined, acc: elapsed })
  const lap = (): void => sw.set({ laps: [...sw.laps, elapsed] })
  const reset = (): void => sw.set({ running: false, startedAt: undefined, acc: 0, laps: [] })

  return (
    <div className="flex h-full w-full flex-col items-center">
      <div className="flex flex-1 flex-col items-center justify-center">
        <BigNumber>{fmtSw(elapsed)}</BigNumber>
      </div>
      <div className="flex w-full max-w-xl items-center justify-between">
        {sw.running ? (
          <RoundButton onClick={lap}>Tur</RoundButton>
        ) : (
          <RoundButton onClick={reset} disabled={elapsed === 0}>
            Sıfırla
          </RoundButton>
        )}
        {!sw.running && elapsed >= 60000 && (
          <button
            className="flex items-center gap-1.5 text-sm text-muted transition hover:text-text"
            onClick={() => {
              addSession({ date: todayKey(), minutes: Math.round(elapsed / 60000), kind: 'diger', note: 'Kronometre' })
              toast(`${Math.round(elapsed / 60000)} dk çalışma olarak kaydedildi`)
              reset()
            }}
          >
            <Save size={15} /> Çalışma olarak kaydet
          </button>
        )}
        {sw.running ? (
          <RoundButton tone="stop" onClick={stop}>
            Durdur
          </RoundButton>
        ) : (
          <RoundButton tone="go" onClick={start}>
            {elapsed ? 'Devam' : 'Başlat'}
          </RoundButton>
        )}
      </div>
      <div className="mt-8 h-[30vh] w-full max-w-xl overflow-y-auto">
        {(sw.laps.length > 0 || sw.running) &&
          [...lapTimes.map((t, i) => ({ i: i + 1, t })), ...(sw.laps.length || sw.running ? [{ i: sw.laps.length + 1, t: currentLap }] : [])]
            .reverse()
            .map(({ i, t }) => (
              <div
                key={i}
                className={cn(
                  'tabular flex items-center justify-between border-t border-border/70 px-1 py-3 text-[17px] font-light',
                  t === best && i <= lapTimes.length && 'text-success',
                  t === worst && i <= lapTimes.length && 'text-danger'
                )}
              >
                <span className="flex items-center gap-2">
                  <Flag size={13} className="text-subtle" /> Tur {i}
                </span>
                <span>{fmtSw(t)}</span>
              </div>
            ))}
      </div>
    </div>
  )
}

/* ---------- Zamanlayıcı ---------- */

const PRESETS = [5, 10, 15, 25, 40, 50, 75, 90]

function fmtTimer(ms: number): string {
  const t = Math.ceil(ms / 1000)
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = t % 60
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

function TimerTab(): React.JSX.Element {
  const tm = useCountdownTimer()
  const running = !!tm.endsAt
  const idle = !running && tm.remaining === undefined
  useTicker(running, 200)
  const left = running ? Math.max(0, tm.endsAt! - Date.now()) : (tm.remaining ?? tm.total)

  useEffect(() => {
    if (running && left <= 0) {
      tm.set({ endsAt: undefined, remaining: undefined, done: true })
      beep()
      try {
        new Notification('Süre doldu', { body: 'Zamanlayıcı tamamlandı.' })
      } catch {
        /* bildirim izni yok */
      }
    }
  }, [running, left, tm])

  const [h, setH] = useState(Math.floor(tm.total / 3600000))
  const [m, setM] = useState(Math.floor((tm.total % 3600000) / 60000))
  const [s, setS] = useState(Math.floor((tm.total % 60000) / 1000))
  const total = (h * 3600 + m * 60 + s) * 1000

  const size = 360
  const r = size / 2 - 8
  const c = 2 * Math.PI * r
  const frac = idle ? 1 : left / tm.total

  return (
    <div className="flex h-full w-full flex-col items-center">
      <div className="flex flex-1 flex-col items-center justify-center">
        {idle ? (
          <>
            <div className="tabular flex items-end gap-2 font-extralight text-text">
              {[
                [h, setH, 23, 'sa'],
                [m, setM, 59, 'dk'],
                [s, setS, 59, 'sn']
              ].map(([v, setV, max, label], i) => (
                <div key={i} className="flex flex-col items-center">
                  <input
                    type="number"
                    min={0}
                    max={max as number}
                    value={pad(v as number)}
                    onChange={(e) => (setV as (n: number) => void)(Math.max(0, Math.min(max as number, Number(e.target.value) || 0)))}
                    onWheel={(e) =>
                      (setV as (n: number) => void)(Math.max(0, Math.min(max as number, (v as number) + (e.deltaY < 0 ? 1 : -1))))
                    }
                    className="w-[1.4em] bg-transparent text-center text-[clamp(56px,10vw,150px)] leading-none outline-none"
                  />
                  <span className="mt-2 text-xs uppercase tracking-[0.2em] text-subtle">{label as string}</span>
                </div>
              ))}
            </div>
            <div className="mt-10 flex flex-wrap justify-center gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setH(Math.floor(p / 60))
                    setM(p % 60)
                    setS(0)
                  }}
                  className={cn(
                    'h-9 rounded-full px-4 text-sm transition',
                    total === p * 60000 ? 'bg-text text-bg' : 'bg-surface-2 text-muted hover:text-text'
                  )}
                >
                  {p} dk
                </button>
              ))}
            </div>
            {tm.done && (
              <div className="mt-6 flex items-center gap-2 text-sm text-success">
                <Bell size={15} /> Süre doldu
              </div>
            )}
          </>
        ) : (
          <div className="relative grid place-items-center" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90">
              <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--surface-3))" strokeWidth={6} />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke="rgb(var(--warning))"
                strokeWidth={6}
                strokeLinecap="round"
                strokeDasharray={c}
                strokeDashoffset={c * (1 - frac)}
                style={{ transition: 'stroke-dashoffset .25s linear' }}
              />
            </svg>
            <div className="absolute text-center">
              <div className="tabular text-[72px] font-extralight leading-none tracking-tight">{fmtTimer(left)}</div>
              <div className="mt-3 flex items-center justify-center gap-1.5 text-sm text-subtle">
                <Bell size={13} />
                {new Date(Date.now() + left).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="mb-[12vh] flex w-full max-w-xl items-center justify-between">
        <RoundButton onClick={() => tm.set({ endsAt: undefined, remaining: undefined, done: false })} disabled={idle}>
          İptal
        </RoundButton>
        {running ? (
          <RoundButton tone="stop" onClick={() => tm.set({ endsAt: undefined, remaining: left })}>
            Duraklat
          </RoundButton>
        ) : (
          <RoundButton
            tone="go"
            disabled={idle && total === 0}
            onClick={() =>
              idle
                ? tm.set({ total, endsAt: Date.now() + total, remaining: undefined, done: false })
                : tm.set({ endsAt: Date.now() + left, remaining: undefined })
            }
          >
            {idle ? 'Başlat' : 'Devam'}
          </RoundButton>
        )}
      </div>
    </div>
  )
}

/* ---------- Sayfa ---------- */

const TABS: { id: Tab; label: string }[] = [
  { id: 'countdown', label: 'Geri Sayım' },
  { id: 'stopwatch', label: 'Kronometre' },
  { id: 'timer', label: 'Zamanlayıcı' }
]

export default function Focus(): React.JSX.Element {
  const go = useNav((s) => s.go)
  const [tab, setTab] = useState<Tab>('countdown')
  const [full, setFull] = useState(!!document.fullscreenElement)

  useEffect(() => {
    const onChange = (): void => setFull(!!document.fullscreenElement)
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'F11') {
        e.preventDefault()
        toggleFull()
      }
      if (e.key === 'Escape' && !document.fullscreenElement && !(e.target instanceof HTMLInputElement)) go('dashboard')
    }
    document.addEventListener('fullscreenchange', onChange)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      window.removeEventListener('keydown', onKey)
      if (document.fullscreenElement) void document.exitFullscreen()
    }
  }, [go])

  const toggleFull = (): void => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen()
  }

  return (
    <div className="relative flex h-full w-full select-none flex-col bg-bg">
      {/* Üst çubuk: tam ekranda gizli kalır, fareyle üzerine gelince görünür */}
      <div className={cn('drag flex h-14 shrink-0 items-center justify-between px-5 transition-opacity', full && 'opacity-0 hover:opacity-100')}>
        <button
          className="no-drag flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted transition hover:bg-surface-2 hover:text-text"
          onClick={() => go('dashboard')}
        >
          <ArrowLeft size={15} /> Uygulamaya dön
        </button>
        <div className="no-drag flex rounded-full bg-surface-2 p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'h-8 rounded-full px-5 text-sm font-medium transition',
                tab === t.id ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          className="no-drag mr-[140px] flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted transition hover:bg-surface-2 hover:text-text"
          onClick={toggleFull}
          title="Tam ekran (F11)"
        >
          {full ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          {full ? 'Küçült' : 'Tam ekran'}
        </button>
      </div>
      <div className="min-h-0 flex-1 px-[6vw] pb-8">
        {tab === 'countdown' && <CountdownTab />}
        {tab === 'stopwatch' && <StopwatchTab />}
        {tab === 'timer' && <TimerTab />}
      </div>
    </div>
  )
}
