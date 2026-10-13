// Tam ekran sayaç: geri sayım listesi, kronometre ve zamanlayıcı.
// Kenar çubuğu olmadan tüm pencereyi kaplar; tam ekran (F11) desteklenir.
import { ArrowLeft, Bell, Flag, Maximize2, Minimize2, Plus, Save, Sparkles, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { cn, toast } from '@/components/ui'
import { Aurora, BG_KEY, BigNumber, RoundButton, type Backdrop } from '@/components/glass'
import { beep, fmtSw, fmtTimer, swElapsed, useCountdownTimer, useStopwatch, useTicker } from '@/lib/clocks'
import { formatDate, pad, todayKey } from '@/lib/date'
import { useNav } from '@/lib/nav'
import { useStore } from '@/lib/store'

type Tab = 'countdown' | 'stopwatch' | 'timer'

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
    <div className="grid h-full w-full grid-cols-1 gap-10 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col items-center justify-center text-center">
        <div className="mb-6 text-sm font-semibold uppercase tracking-[0.25em] text-muted">{current.title}</div>
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
            <div className="mt-8 text-sm text-muted">
              {formatDate(current.at.slice(0, 10))} · {current.at.slice(11, 16)}
              {current.fixed && ' · tahmini tarih, Ayarlar’dan değiştirilebilir'}
            </div>
          </>
        ) : (
          <BigNumber size="lg">Bugün 🎉</BigNumber>
        )}
      </div>

      {/* Liste */}
      <div className="glass flex min-h-0 flex-col self-center rounded-[28px] p-3">
        <div className="mb-2 flex items-center justify-between px-3 pt-1">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Geri sayımlar</span>
          <button className="text-subtle transition hover:text-text" onClick={() => setAdding((v) => !v)} aria-label="Ekle" title="Ekle">
            <Plus size={18} />
          </button>
        </div>
        {adding && (
          <div className="mb-3 space-y-2 rounded-2xl bg-bg/40 p-3">
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
        <div className="max-h-[56vh] space-y-1 overflow-y-auto">
          {items.map((it) => {
            const dd = splitDiff(parseLocal(it.at).getTime() - Date.now())
            const past = parseLocal(it.at).getTime() <= Date.now()
            return (
              <div
                key={it.id}
                onClick={() => setSelected(it.id)}
                className={cn(
                  'group flex cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 transition',
                  it.id === current.id ? 'bg-white/[0.12] shadow-[inset_0_1px_0_rgb(255_255_255/0.25)]' : 'hover:bg-white/[0.06]'
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-medium">{it.title}</div>
                  <div className="text-xs text-muted">{formatDate(it.at.slice(0, 10))}</div>
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
      <div className={cn('mt-8 h-[30vh] w-full max-w-xl overflow-y-auto rounded-[28px] px-5', (sw.laps.length > 0 || sw.running) && 'glass')}>
        {(sw.laps.length > 0 || sw.running) &&
          [...lapTimes.map((t, i) => ({ i: i + 1, t })), ...(sw.laps.length || sw.running ? [{ i: sw.laps.length + 1, t: currentLap }] : [])]
            .reverse()
            .map(({ i, t }) => (
              <div
                key={i}
                className={cn(
                  'tabular flex items-center justify-between border-b border-white/10 px-1 py-3 text-[17px] font-light last:border-0',
                  t === best && i <= lapTimes.length && 'font-normal text-success dark:text-[#7fd6a0]',
                  t === worst && i <= lapTimes.length && 'font-normal text-danger dark:text-[#f08f8f]'
                )}
              >
                <span className="flex items-center gap-2">
                  <Flag size={13} className="opacity-60" /> Tur {i}
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
                    'glass glass-press h-10 rounded-full px-5 text-sm font-medium',
                    total === p * 60000 ? 'text-text' : 'text-muted hover:text-text'
                  )}
                  style={total === p * 60000 ? { backgroundColor: 'rgb(var(--accent) / 0.35)' } : undefined}
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
          <div className="glass relative grid place-items-center rounded-full" style={{ width: size + 40, height: size + 40 }}>
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
  const [backdrop, setBackdrop] = useState<Backdrop>(() => {
    try {
      return (localStorage.getItem(BG_KEY) as Backdrop) || 'aurora'
    } catch {
      return 'aurora'
    }
  })
  const changeBackdrop = (b: Backdrop): void => {
    setBackdrop(b)
    try {
      localStorage.setItem(BG_KEY, b)
    } catch {
      /* yoksay */
    }
  }
  const tabIndex = TABS.findIndex((t) => t.id === tab)
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
    <div className="lg-scene relative flex h-full w-full select-none flex-col overflow-hidden bg-bg">
      {backdrop === 'aurora' && <Aurora />}
      {/* Üst çubuk: tam ekranda gizli kalır, fareyle üzerine gelince görünür */}
      <div
        className={cn(
          'drag relative z-10 flex h-16 shrink-0 items-center justify-between px-5 transition-opacity duration-500',
          full && 'opacity-0 hover:opacity-100'
        )}
      >
        <button
          className="glass glass-press no-drag flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-text"
          onClick={() => go('dashboard')}
        >
          <ArrowLeft size={15} /> Uygulama
        </button>
        <div className="glass no-drag relative flex rounded-full p-1">
          {/* Kayan cam mercek */}
          <span
            className="absolute bottom-1 top-1 rounded-full bg-white/[0.16] shadow-[inset_0_1px_0_rgb(255_255_255/0.45),0_4px_14px_-4px_rgb(0_0_0/0.35)] transition-transform duration-500 [transition-timing-function:cubic-bezier(0.34,1.4,0.64,1)]"
            style={{ width: 120, left: 4, transform: `translateX(${tabIndex * 120}px)` }}
          />
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn('relative z-10 h-9 w-[120px] rounded-full text-sm font-semibold transition-colors', tab === t.id ? 'text-text' : 'text-muted hover:text-text')}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="no-drag mr-[140px] flex items-center gap-2">
          <button
            className="glass glass-press flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-text"
            onClick={() => changeBackdrop(backdrop === 'aurora' ? 'plain' : 'aurora')}
            title="Arka plan"
          >
            <Sparkles size={15} /> {backdrop === 'aurora' ? 'Cam' : 'Sade'}
          </button>
          <button
            className="glass glass-press flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-text"
            onClick={toggleFull}
            title="Tam ekran (F11)"
          >
            {full ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            {full ? 'Küçült' : 'Tam ekran'}
          </button>
        </div>
      </div>
      <div key={tab} className="relative z-10 min-h-0 flex-1 animate-fade-in px-[6vw] pb-8">
        {tab === 'countdown' && <CountdownTab />}
        {tab === 'stopwatch' && <StopwatchTab />}
        {tab === 'timer' && <TimerTab />}
      </div>
    </div>
  )
}
