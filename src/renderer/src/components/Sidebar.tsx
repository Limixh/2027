import {
  BarChart3,
  BookOpenCheck,
  Bot,
  CalendarClock,
  ClipboardList,
  AlarmClock,
  Flame,
  Gauge,
  ListChecks,
  LayoutDashboard,
  Moon,
  NotebookPen,
  Pause,
  Play,
  Settings,
  Sun,
  Timer
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { SUBJECT_MAP } from '@/data/curriculum'
import { useNav, type PageId } from '@/lib/nav'
import { currentStreak, daysUntil, minutesByDay } from '@/lib/stats'
import { useStore } from '@/lib/store'
import { elapsedMs, fmtClock, useTimer } from '@/lib/timer'
import { cn } from './ui'

const NAV: { id: PageId; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Genel Bakış', icon: LayoutDashboard },
  { id: 'room', label: 'Çalışma Odası', icon: ListChecks },
  { id: 'study', label: 'Çalışma Takibi', icon: CalendarClock },
  { id: 'practice', label: 'Soru Pratiği', icon: Gauge },
  { id: 'exams', label: 'Denemeler', icon: ClipboardList },
  { id: 'topics', label: 'Konu Takibi', icon: BookOpenCheck },
  { id: 'analysis', label: 'Hata Analizi', icon: BarChart3 },
  { id: 'mistakes', label: 'Hata Defteri', icon: NotebookPen },
  { id: 'ai', label: 'AI Koç', icon: Bot },
  { id: 'focus', label: 'Sayaç', icon: AlarmClock }
]

function MiniTimer(): React.JSX.Element | null {
  const timer = useTimer()
  const go = useNav((s) => s.go)
  const [, tick] = useState(0)
  useEffect(() => {
    if (!timer.running) return
    const id = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [timer.running])
  const ms = elapsedMs(timer)
  if (!timer.running && ms === 0) return null
  const subject = timer.subjectId ? SUBJECT_MAP[timer.subjectId] : undefined
  return (
    <div className="no-drag mx-3 mb-3 rounded-xl border border-accent/30 bg-accent/10 p-3">
      <div className="flex items-center justify-between">
        <button className="flex items-center gap-2 text-left" onClick={() => go('study')}>
          <Timer size={15} className={cn('text-accent', timer.running && 'animate-pulse')} />
          <span className="tabular text-lg font-semibold text-text">{fmtClock(ms)}</span>
        </button>
        <button
          className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-on-accent"
          onClick={() => (timer.running ? timer.pause() : timer.start())}
          aria-label={timer.running ? 'Duraklat' : 'Devam et'}
        >
          {timer.running ? <Pause size={13} /> : <Play size={13} />}
        </button>
      </div>
      <div className="mt-1 truncate text-[11px] text-muted">
        {timer.onBreak ? 'Mola' : subject ? subject.name : 'Çalışma oturumu'}
      </div>
    </div>
  )
}

export function Sidebar(): React.JSX.Element {
  const page = useNav((s) => s.page)
  const go = useNav((s) => s.go)
  const settings = useStore((s) => s.data.settings)
  const sessions = useStore((s) => s.data.sessions)
  const updateSettings = useStore((s) => s.updateSettings)

  const streak = useMemo(() => currentStreak(minutesByDay(sessions)), [sessions])
  const left = daysUntil(settings.examDate)
  const dark = document.documentElement.classList.contains('dark')

  return (
    <aside className="drag flex w-[244px] shrink-0 flex-col border-r border-border bg-surface/60">
      <div className="flex h-10 items-center px-5" />
      <div className="no-drag px-5 pb-5">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-accent to-accent-2 text-sm font-bold text-on-accent shadow-glow">
            27
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight">YKS 2027</div>
            <div className="text-[11px] text-muted">Çalışma Takip</div>
          </div>
        </div>
      </div>

      <div className="no-drag mx-3 mb-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-border bg-surface-2 px-3 py-2">
          <div className="tabular text-lg font-semibold leading-tight">{left > 0 ? left : 0}</div>
          <div className="text-[10px] uppercase tracking-wide text-subtle">gün kaldı</div>
        </div>
        <div className="rounded-xl border border-border bg-surface-2 px-3 py-2">
          <div className="tabular flex items-center gap-1 text-lg font-semibold leading-tight">
            {streak}
            <Flame size={15} className={streak > 0 ? 'text-warning' : 'text-subtle'} />
          </div>
          <div className="text-[10px] uppercase tracking-wide text-subtle">gün seri</div>
        </div>
      </div>

      <nav className="no-drag flex-1 space-y-0.5 overflow-y-auto px-3">
        {NAV.map((item) => {
          const Icon = item.icon
          const active = page === item.id
          return (
            <button
              key={item.id}
              onClick={() => go(item.id)}
              className={cn(
                'group relative flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
                active ? 'bg-accent/12 text-text' : 'text-muted hover:bg-surface-2 hover:text-text'
              )}
              style={active ? { background: 'rgb(var(--accent) / 0.12)' } : undefined}
            >
              {active && <span className="absolute left-0 top-2 h-5 w-[3px] rounded-r-full bg-accent" />}
              <Icon size={17} className={active ? 'text-accent' : 'text-subtle group-hover:text-muted'} />
              {item.label}
              {item.id === 'ai' && (
                <span className="ml-auto rounded bg-gradient-to-r from-accent to-accent-2 px-1.5 text-[10px] font-semibold text-on-accent">
                  AI
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <MiniTimer />

      <div className="no-drag flex items-center gap-1 border-t border-border p-3">
        <button
          onClick={() => go('settings')}
          className={cn(
            'flex h-9 flex-1 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
            page === 'settings' ? 'bg-surface-2 text-text' : 'text-muted hover:bg-surface-2 hover:text-text'
          )}
        >
          <Settings size={17} className="text-subtle" />
          <span className="truncate">{settings.name ? settings.name : 'Ayarlar'}</span>
        </button>
        <button
          className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text"
          onClick={() => updateSettings({ theme: dark ? 'light' : 'dark' })}
          aria-label="Tema değiştir"
          title="Tema değiştir"
        >
          {dark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </aside>
  )
}
