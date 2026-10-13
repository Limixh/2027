// Çalışma Odası: solda tek büyük araç, sağda günün planı. Sade, kutusuz.
import { ArrowLeft, ChevronLeft, ChevronRight, Maximize2, Minimize2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/components/ui'
import { isOverlayOpen } from '@/components/room/parts'
import PlanPanel from '@/components/room/PlanPanel'
import { loadTool, saveTool, TOOLS, useActiveTask, type ToolType } from '@/components/room/stores'
import { ToolBody } from '@/components/room/Tools'
import { addDays, formatDate, todayKey, weekdayName } from '@/lib/date'
import { useNav } from '@/lib/nav'

export default function Room(): React.JSX.Element {
  const go = useNav((s) => s.go)
  const [date, setDate] = useState(todayKey())
  const today = todayKey()
  const isToday = date === today
  const [full, setFull] = useState(!!document.fullscreenElement)
  const activeId = useActiveTask((s) => s.taskId)
  const [tool, setTool] = useState<ToolType>(() => (useActiveTask.getState().taskId ? 'stopwatch' : loadTool()))

  // Görev başlatılınca kronometre otomatik açılır
  useEffect(() => {
    if (activeId) setTool('stopwatch')
  }, [activeId])

  const pickTool = (t: ToolType): void => {
    setTool(t)
    saveTool(t)
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

  const dayName = isToday ? 'Bugün' : date === addDays(today, -1) ? 'Dün' : date === addDays(today, 1) ? 'Yarın' : date < today ? 'Geçmiş' : 'Gelecek'
  const ghost = 'no-drag grid h-9 w-9 place-items-center rounded-full text-muted transition hover:bg-text/[0.07] hover:text-text'

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-bg">
      <div className={cn('drag grid h-16 shrink-0 grid-cols-[1fr_auto_1fr] items-center px-8 transition-opacity duration-500', full && 'opacity-0 hover:opacity-100')}>
        <div className="no-drag flex items-center gap-3">
          <button className="flex h-9 items-center gap-1.5 rounded-full pr-3 text-sm text-muted transition hover:text-text" onClick={() => go('dashboard')} title="Uygulamaya dön (Esc)">
            <ArrowLeft size={16} /> Uygulama
          </button>
          <span className="text-sm font-medium text-text">Çalışma Odası</span>
        </div>
        <div className="no-drag flex items-center gap-1">
          <button className={ghost} onClick={() => setDate(addDays(date, -1))} aria-label="Önceki gün" title="Önceki gün">
            <ChevronLeft size={16} />
          </button>
          <button className="flex h-9 min-w-[176px] items-center justify-center gap-2 rounded-full px-3 text-sm transition hover:bg-text/[0.07]" onClick={() => setDate(today)} title="Bugüne dön">
            <span className={cn('font-medium', isToday ? 'text-text' : 'text-muted')}>{dayName}</span>
            <span className="text-muted">
              {formatDate(date, false)} {weekdayName(date)}
            </span>
          </button>
          <button className={ghost} onClick={() => setDate(addDays(date, 1))} aria-label="Sonraki gün" title="Sonraki gün">
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="no-drag mr-[140px] flex items-center justify-end">
          <button className={ghost} onClick={toggleFull} aria-label="Tam ekran" title="Tam ekran (F11)">
            {full ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 animate-fade-in grid-cols-[minmax(0,1fr)_minmax(340px,400px)] gap-x-12 px-8 pb-8 min-[1300px]:gap-x-20 min-[1300px]:px-14">
        <section className="flex min-h-0 min-w-0 flex-col items-center">
          <div className="flex h-9 shrink-0 items-center gap-1" role="tablist" aria-label="Araç">
            {TOOLS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tool === t.id}
                onClick={() => pickTool(t.id)}
                className={cn('h-9 rounded-full px-3.5 text-sm transition', tool === t.id ? 'bg-text/[0.07] font-medium text-text' : 'text-muted hover:text-text')}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center pb-10 text-center">
            <ToolBody key={tool} tool={tool} />
          </div>
        </section>
        <PlanPanel key={date} date={date} isToday={isToday} />
      </div>
    </div>
  )
}
