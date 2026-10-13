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

/* ---------- Seçili araç (localStorage) ---------- */

export type ToolType = 'clock' | 'timer' | 'stopwatch' | 'exam'
export const TOOL_KEY = 'yks-room-tool'
export const TOOLS: { id: ToolType; label: string }[] = [
  { id: 'clock', label: 'Saat' },
  { id: 'timer', label: 'Geri sayım' },
  { id: 'stopwatch', label: 'Kronometre' },
  { id: 'exam', label: 'YKS’ye kalan' }
]

export function loadTool(): ToolType {
  try {
    const raw = localStorage.getItem(TOOL_KEY)
    if (TOOLS.some((t) => t.id === raw)) return raw as ToolType
  } catch {
    /* yoksay */
  }
  return 'clock'
}

export function saveTool(t: ToolType): void {
  try {
    localStorage.setItem(TOOL_KEY, t)
  } catch {
    /* yoksay */
  }
}
