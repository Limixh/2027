// Çalışma Odası: sayfalar arası korunan küçük durumlar.
import { create } from 'zustand'

/** Şu an üzerinde çalışılan plan görevi (kronometre ile birlikte başlar). */
interface ActiveTaskState {
  taskId?: string
  date?: string
  startedAt?: number
  start(date: string, taskId: string): void
  clear(): void
}
export const useActiveTask = create<ActiveTaskState>((set) => ({
  start: (date, taskId) => set({ date, taskId, startedAt: Date.now() }),
  clear: () => set({ date: undefined, taskId: undefined, startedAt: undefined })
}))

/** Pomodoro: odaklanma / mola döngüsü. */
export type PomoPhase = 'work' | 'break'
interface PomodoroState {
  phase: PomoPhase
  /** Çalışırken bitiş anı */
  endsAt?: number
  /** Duraklatıldığında kalan (ms) */
  remaining?: number
  /** Tamamlanan odaklanma sayısı */
  cycles: number
  set(p: Partial<PomodoroState>): void
}
export const usePomodoro = create<PomodoroState>((set) => ({ phase: 'work', cycles: 0, set: (p) => set(p) }))

/* ---------- Araç listesi (localStorage) ---------- */

export type WidgetType = 'clock' | 'timer' | 'stopwatch' | 'pomodoro' | 'exam' | 'progress'
export const WIDGET_KEY = 'yks-room-widgets'
export const DEFAULT_WIDGETS: WidgetType[] = ['clock', 'timer', 'stopwatch', 'progress', 'exam']
const ALL: WidgetType[] = ['clock', 'timer', 'stopwatch', 'pomodoro', 'exam', 'progress']

export function loadWidgets(): WidgetType[] {
  try {
    const raw = localStorage.getItem(WIDGET_KEY)
    if (raw) {
      const arr = JSON.parse(raw) as unknown
      if (Array.isArray(arr)) {
        const out: WidgetType[] = []
        for (const x of arr) if (ALL.includes(x as WidgetType) && !out.includes(x as WidgetType)) out.push(x as WidgetType)
        return out
      }
    }
  } catch {
    /* yoksay */
  }
  return DEFAULT_WIDGETS
}

export function saveWidgets(list: WidgetType[]): void {
  try {
    localStorage.setItem(WIDGET_KEY, JSON.stringify(list))
  } catch {
    /* yoksay */
  }
}
