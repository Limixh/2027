// Tam ekran sayaç: geri sayım listesi, kronometre ve zamanlayıcı.
// Kenar çubuğu olmadan tüm pencereyi kaplar; tam ekran (F11) desteklenir.
import { ArrowLeft, Maximize2, Minimize2, Plus, Sparkles, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { cn, toast } from '@/components/ui'
import { Aurora, BG_KEY, BigNumber, type Backdrop } from '@/components/glass'
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

/* ---------- Kronometre / Zamanlayıcı ortak parçaları ---------- */

/** Sade hap düğme: hafif yüzey tonu; yeşil/kırmızı yalnızca yazı rengi ve çok açık zemin */
function SimpleButton({
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
    neutral: 'bg-text/[0.07] text-text hover:bg-text/[0.12]',
    go: 'bg-success/[0.12] text-success hover:bg-success/[0.2]',
    stop: 'bg-danger/[0.12] text-danger hover:bg-danger/[0.2]'
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'h-11 min-w-[124px] rounded-full px-6 text-[15px] font-medium transition active:scale-[0.97] disabled:pointer-events-none disabled:opacity-35',
        tones[tone]
      )}
    >
      {children}
    </button>
  )
}

/** Sağ listelerin küçük başlığı */
function ListTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }): React.JSX.Element {
  return (
    <div className="mb-2 flex items-center justify-between px-1">
      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">{children}</span>
      {right}
    </div>
  )
}

const ROW = 'flex items-center gap-3 border-b border-text/10 px-1 py-3 last:border-b-0'

/* ---------- Kronometre ---------- */

function StopwatchTab(): React.JSX.Element {
  const sw = useStopwatch()
  const addSession = useStore((s) => s.addSession)
  useTicker(sw.running)
  const elapsed = swElapsed(sw)

  // Tamamlanan tur süreleri; devam eden tur ayrıca hesaplanır
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
  const hasCurrent = sw.running || elapsed > 0
  const rows = [
    ...(hasCurrent ? [{ n: lapTimes.length + 1, t: currentLap, live: true }] : []),
    ...lapTimes.map((t, i) => ({ n: i + 1, t, live: false })).reverse()
  ]

  const start = (): void => sw.set({ running: true, startedAt: Date.now() })
  const stop = (): void => sw.set({ running: false, startedAt: undefined, acc: elapsed })
  const lap = (): void => sw.set({ laps: [...sw.laps, elapsed] })
  const reset = (): void => sw.set({ running: false, startedAt: undefined, acc: 0, laps: [] })

  const [main, cs] = fmtSw(elapsed).split(',')
  const canSave = !sw.running && elapsed >= 60000

  return (
    <div className="grid h-full w-full grid-cols-1 gap-10 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col items-center justify-center text-center">
        <div className="mb-6 text-sm font-semibold uppercase tracking-[0.25em] text-muted">
          {sw.running ? 'Çalışıyor' : elapsed > 0 ? 'Durduruldu' : 'Kronometre'}
        </div>
        <div
          className={cn(
            'tabular relative font-extralight leading-none tracking-tight text-text',
            main.length > 5 ? 'text-[clamp(56px,10vw,150px)]' : 'text-[clamp(64px,14vw,200px)]'
          )}
        >
          {main}
          <span className="absolute bottom-0 left-full ml-1 text-[0.4em] leading-[1.05] text-muted">,{cs}</span>
        </div>
        <div className="tabular mt-6 h-5 text-sm text-muted">
          {sw.laps.length > 0 && (
            <>
              Tur {sw.laps.length + 1} · {fmtSw(currentLap)}
            </>
          )}
        </div>
        <div className="mt-8 flex items-center gap-3">
          {sw.running ? (
            <SimpleButton onClick={lap}>Tur</SimpleButton>
          ) : (
            <SimpleButton onClick={reset} disabled={elapsed === 0}>
              Sıfırla
            </SimpleButton>
          )}
          {sw.running ? (
            <SimpleButton tone="stop" onClick={stop}>
              Durdur
            </SimpleButton>
          ) : (
            <SimpleButton tone="go" onClick={start}>
              {elapsed ? 'Devam' : 'Başlat'}
            </SimpleButton>
          )}
        </div>
        <div className="mt-4 h-8">
          {canSave && (
            <button
              className="text-sm text-muted transition hover:text-text"
              onClick={() => {
                addSession({ date: todayKey(), minutes: Math.round(elapsed / 60000), kind: 'diger', note: 'Kronometre' })
                toast(`${Math.round(elapsed / 60000)} dk çalışma olarak kaydedildi`)
                reset()
              }}
            >
              Çalışma olarak kaydet
            </button>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-col self-center">
        {rows.length === 0 ? (
          <div className="px-1 text-sm text-muted">Tur almak için çalışırken Tur’a bas.</div>
        ) : (
          <>
            <ListTitle right={lapTimes.length > 0 ? <span className="tabular text-xs text-muted">{lapTimes.length} tur</span> : undefined}>
              Turlar
            </ListTitle>
            <div className="max-h-[56vh] overflow-y-auto">
              {rows.map(({ n, t, live }) => {
                const isBest = !live && t === best && best !== worst
                const isWorst = !live && t === worst && best !== worst
                return (
                  <div key={n} className={ROW}>
                    <div className={cn('flex-1 text-[15px]', live ? 'text-muted' : 'text-text')}>Tur {n}</div>
                    <div
                      className={cn(
                        'tabular text-xl font-light',
                        live ? 'text-muted' : isBest ? 'text-success' : isWorst ? 'text-danger' : 'text-text/90'
                      )}
                    >
                      {fmtSw(t)}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ---------- Zamanlayıcı ---------- */

const PRESETS: { name: string; min: number; desc: string }[] = [
  { name: 'Pomodoro', min: 25, desc: 'Tek odak turu' },
  { name: 'Derin odak', min: 50, desc: 'Kesintisiz, tek konu' },
  { name: 'Kısa mola', min: 5, desc: 'Kalk, su iç, esne' },
  { name: 'Uzun mola', min: 15, desc: '4 pomodoro sonrası' },
  { name: 'Paragraf seti', min: 20, desc: '10–12 paragraf sorusu' },
  { name: '40 soru Matematik', min: 50, desc: 'Sınav temposunda çözüm' },
  { name: 'TYT deneme', min: 165, desc: '120 soru · tam süre' },
  { name: 'AYT deneme', min: 180, desc: '80 soru · tam süre' }
]
const MIN_TOTAL = 60000
const MAX_TOTAL = 12 * 3600000

const endClock = (ms: number): string =>
  new Date(Date.now() + ms).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })

function TimerTab(): React.JSX.Element {
  const tm = useCountdownTimer()
  const running = !!tm.endsAt
  const idle = !running && tm.remaining === undefined
  const paused = !running && !idle
  useTicker(running, 100)
  useTicker(idle, 1000)
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

  const done = idle && tm.done
  const adjust = (deltaMs: number): void =>
    tm.set({ total: Math.max(MIN_TOTAL, Math.min(MAX_TOTAL, tm.total + deltaMs)), done: false })
  const start = (): void => {
    try {
      if (Notification.permission === 'default') void Notification.requestPermission()
    } catch {
      /* yoksay */
    }
    tm.set({ endsAt: Date.now() + tm.total, remaining: undefined, done: false })
  }

  const frac = idle ? 1 : Math.max(0, Math.min(1, left / tm.total))
  const clock = fmtTimer(left)
  const stepBtn = 'rounded-full px-3 py-1 text-sm text-muted transition hover:text-text disabled:pointer-events-none disabled:opacity-30'

  return (
    <div className="grid h-full w-full grid-cols-1 gap-10 lg:grid-cols-[1fr_360px]">
      <div
        className="flex flex-col items-center justify-center text-center"
        onWheel={(e) => {
          if (idle) adjust(e.deltaY < 0 ? 60000 : -60000)
        }}
      >
        <div className="mb-6 text-sm font-semibold uppercase tracking-[0.25em] text-muted">
          {done ? 'Zamanlayıcı' : idle ? 'Süre' : paused ? 'Duraklatıldı' : 'Kalan'}
        </div>
        {done ? (
          <div className="tabular font-extralight leading-none tracking-tight text-text text-[clamp(48px,9vw,128px)]">Süre doldu</div>
        ) : (
          <div
            className={cn(
              'tabular font-extralight leading-none tracking-tight text-text',
              clock.length > 5 ? 'text-[clamp(56px,10vw,150px)]' : 'text-[clamp(64px,14vw,200px)]'
            )}
          >
            {clock}
          </div>
        )}

        {/* Alt satır: ayar düğmeleri (boştayken) ya da ince ilerleme çizgisi */}
        <div className="mt-6 flex h-8 w-[min(420px,70%)] items-center justify-center">
          {idle && !done ? (
            <div className="flex items-center gap-4">
              <button className={stepBtn} onClick={() => adjust(-5 * 60000)} disabled={tm.total <= MIN_TOTAL} aria-label="5 dk azalt">
                − 5 dk
              </button>
              <button className={stepBtn} onClick={() => adjust(5 * 60000)} disabled={tm.total >= MAX_TOTAL} aria-label="5 dk artır">
                + 5 dk
              </button>
            </div>
          ) : done ? (
            <span className="tabular text-sm text-muted">{fmtTimer(tm.total)} tamamlandı</span>
          ) : (
            <div className="h-0.5 w-full overflow-hidden rounded-full bg-text/15">
              <div className="h-full bg-accent" style={{ width: `${frac * 100}%` }} />
            </div>
          )}
        </div>
        <div className="tabular mt-1 h-5 text-sm text-muted">{!done && !paused && `bitiş ≈ ${endClock(left)}`}</div>

        <div className="mt-8 flex items-center gap-3">
          {done ? (
            <SimpleButton onClick={() => tm.set({ done: false })}>Tamam</SimpleButton>
          ) : (
            <SimpleButton onClick={() => tm.set({ endsAt: undefined, remaining: undefined, done: false })} disabled={idle}>
              İptal
            </SimpleButton>
          )}
          {running ? (
            <SimpleButton tone="stop" onClick={() => tm.set({ endsAt: undefined, remaining: left })}>
              Duraklat
            </SimpleButton>
          ) : (
            <SimpleButton tone="go" onClick={() => (idle ? start() : tm.set({ endsAt: Date.now() + left, remaining: undefined }))}>
              {done ? 'Tekrar' : idle ? 'Başlat' : 'Devam'}
            </SimpleButton>
          )}
        </div>
        <div className="mt-4 h-8" />
      </div>

      <div className="flex min-h-0 flex-col self-center">
        <ListTitle>Hazır süreler</ListTitle>
        <div className={cn('max-h-[calc(100vh-220px)] overflow-y-auto', !idle && 'pointer-events-none opacity-50')}>
          {PRESETS.map((p) => {
            const on = PRESETS.find((q) => q.min * 60000 === tm.total) === p
            return (
              <div
                key={p.name}
                onClick={() => tm.set({ total: p.min * 60000, done: false })}
                className={cn(ROW, 'cursor-pointer py-2.5 transition-colors', on ? 'text-accent' : 'text-text hover:text-accent')}
              >
                <div className="min-w-0 flex-1">
                  <div className={cn('truncate text-[15px]', on ? 'font-semibold' : 'font-medium')}>{p.name}</div>
                  <div className="truncate text-xs text-muted">{p.desc}</div>
                </div>
                <div className={cn('tabular text-right text-lg', on ? 'font-medium' : 'font-light')}>
                  {p.min}
                  <span className="ml-1 text-xs font-normal text-muted">dk</span>
                </div>
              </div>
            )
          })}
        </div>
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
