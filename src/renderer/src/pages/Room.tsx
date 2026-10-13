// Çalışma Odası: araç panosu + günün planı. Tam pencere, Liquid Glass.
import { ArrowLeft, ChevronLeft, ChevronRight, Maximize2, Minimize2, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/components/ui'
import { Aurora, BG_KEY, type Backdrop } from '@/components/glass'
import { isOverlayOpen } from '@/components/room/parts'
import PlanPanel from '@/components/room/PlanPanel'
import WidgetBoard from '@/components/room/WidgetBoard'
import { addDays, formatDate, todayKey, weekdayName } from '@/lib/date'
import { useNav } from '@/lib/nav'

export default function Room(): React.JSX.Element {
  const go = useNav((s) => s.go)
  const [date, setDate] = useState(todayKey())
  const today = todayKey()
  const isToday = date === today
  const [full, setFull] = useState(!!document.fullscreenElement)
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

  const toggleFull = (): void => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen()
  }

  useEffect(() => {
    const onChange = (): void => setFull(!!document.fullscreenElement)
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'F11') {
        e.preventDefault()
        toggleFull()
      }
      const t = e.target
      const typing = t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement
      if (e.key === 'Escape' && !document.fullscreenElement && !typing && !isOverlayOpen()) go('dashboard')
    }
    document.addEventListener('fullscreenchange', onChange)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      window.removeEventListener('keydown', onKey)
      if (document.fullscreenElement) void document.exitFullscreen()
    }
  }, [go])

  return (
    <div className="lg-scene relative flex h-full w-full flex-col overflow-hidden bg-bg">
      {backdrop === 'aurora' && <Aurora />}
      <div className={cn('drag relative z-10 flex h-16 shrink-0 items-center justify-between px-5 transition-opacity duration-500', full && 'opacity-0 hover:opacity-100')}>
        <button className="glass glass-press no-drag flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-text" onClick={() => go('dashboard')}>
          <ArrowLeft size={15} /> Uygulama
        </button>
        <div className="no-drag flex items-center gap-4">
          <h1 className="hidden text-base font-semibold text-text min-[1250px]:block">Çalışma Odası</h1>
          <div className="glass flex h-10 items-center rounded-full p-1">
            <button className="grid h-8 w-8 place-items-center rounded-full text-text transition hover:bg-text/10" onClick={() => setDate(addDays(date, -1))} aria-label="Önceki gün" title="Önceki gün">
              <ChevronLeft size={16} />
            </button>
            <button
              className="flex h-8 min-w-[196px] items-center justify-center gap-2 rounded-full px-3 text-sm text-text transition hover:bg-text/10"
              onClick={() => setDate(today)}
              title="Bugüne dön"
            >
              <span className={cn('font-semibold', !isToday && 'text-muted')}>{isToday ? 'Bugün' : date === addDays(today, -1) ? 'Dün' : date === addDays(today, 1) ? 'Yarın' : date < today ? 'Geçmiş' : 'Gelecek'}</span>
              <span className="text-muted">·</span>
              <span className="font-medium">
                {formatDate(date, false)} {weekdayName(date)}
              </span>
            </button>
            <button className="grid h-8 w-8 place-items-center rounded-full text-text transition hover:bg-text/10" onClick={() => setDate(addDays(date, 1))} aria-label="Sonraki gün" title="Sonraki gün">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <div className="no-drag mr-[140px] flex items-center gap-2">
          <button
            className="glass glass-press flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-text"
            onClick={() => changeBackdrop(backdrop === 'aurora' ? 'plain' : 'aurora')}
            title="Arka plan"
          >
            <Sparkles size={15} /> {backdrop === 'aurora' ? 'Cam' : 'Sade'}
          </button>
          <button className="glass glass-press flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-text" onClick={toggleFull} title="Tam ekran (F11)">
            {full ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            {full ? 'Küçült' : 'Tam ekran'}
          </button>
        </div>
      </div>
      <div className="relative z-10 grid min-h-0 flex-1 animate-fade-in grid-cols-[minmax(0,1fr)_380px] gap-5 px-5 pb-5">
        <WidgetBoard />
        <PlanPanel key={date} date={date} isToday={isToday} />
      </div>
    </div>
  )
}
