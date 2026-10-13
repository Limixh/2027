// Global kronometre / pomodoro durumu — sayfa değişse de çalışmaya devam eder.
import { create } from 'zustand'

export type TimerMode = 'stopwatch' | 'pomodoro'

interface TimerState {
  mode: TimerMode
  running: boolean
  /** Çalışmaya başlandığı an (ms) — duraklatıldığında undefined */
  startedAt?: number
  /** Önceki koşulardan biriken süre (ms) */
  accumulated: number
  /** Pomodoro hedefi (dk) */
  targetMinutes: number
  subjectId?: string
  topicId?: string
  /** Pomodoro mola modunda mı */
  onBreak: boolean
  setMode(m: TimerMode): void
  setTarget(min: number): void
  setSubject(subjectId?: string, topicId?: string): void
  start(): void
  pause(): void
  reset(): void
  setBreak(b: boolean): void
}

export const useTimer = create<TimerState>((set, get) => ({
  mode: 'pomodoro',
  running: false,
  accumulated: 0,
  targetMinutes: 50,
  onBreak: false,
  setMode: (mode) => set({ mode }),
  setTarget: (targetMinutes) => set({ targetMinutes }),
  setSubject: (subjectId, topicId) => set({ subjectId, topicId }),
  start: () => {
    if (get().running) return
    set({ running: true, startedAt: Date.now() })
  },
  pause: () => {
    const { running, startedAt, accumulated } = get()
    if (!running || !startedAt) return
    set({ running: false, startedAt: undefined, accumulated: accumulated + Date.now() - startedAt })
  },
  reset: () => set({ running: false, startedAt: undefined, accumulated: 0 }),
  setBreak: (onBreak) => set({ onBreak })
}))

/** Geçen süre (ms) */
export function elapsedMs(s: Pick<TimerState, 'running' | 'startedAt' | 'accumulated'>): number {
  return s.accumulated + (s.running && s.startedAt ? Date.now() - s.startedAt : 0)
}

export function fmtClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const p = (n: number): string => String(n).padStart(2, '0')
  return h ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`
}
