// Uygulama genelinde paylaşılan saat durumları (Sayaç ve Çalışma Odası aynı
// kronometreyi/zamanlayıcıyı kullanır; sayfadan çıkınca da çalışmaya devam eder).
import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { pad } from './date'

/* ---------- Kalıcı (sayfadan çıkınca da süren) durumlar ---------- */

export interface StopwatchState {
  running: boolean
  startedAt?: number
  acc: number
  laps: number[]
  set(p: Partial<StopwatchState>): void
}
export const useStopwatch = create<StopwatchState>((set) => ({ running: false, acc: 0, laps: [], set: (p) => set(p) }))

export interface TimerState {
  /** Toplam süre (ms) */
  total: number
  /** Çalışırken bitiş anı */
  endsAt?: number
  /** Duraklatıldığında kalan (ms) */
  remaining?: number
  done: boolean
  set(p: Partial<TimerState>): void
}
export const useCountdownTimer = create<TimerState>((set) => ({ total: 25 * 60000, done: false, set: (p) => set(p) }))

export const swElapsed = (s: Pick<StopwatchState, 'running' | 'startedAt' | 'acc'>): number =>
  s.acc + (s.running && s.startedAt ? Date.now() - s.startedAt : 0)

/** Ekranı ~30 fps yeniler (yalnızca gerektiğinde) */
export function useTicker(active: boolean, ms = 33): void {
  const [, setN] = useState(0)
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setN((n) => n + 1), ms)
    return () => clearInterval(id)
  }, [active, ms])
}

export function beep(): void {
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

export function fmtSw(ms: number): string {
  const cs = Math.floor((ms % 1000) / 10)
  const t = Math.floor(ms / 1000)
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = t % 60
  return `${h ? h + ':' + pad(m) : pad(m)}:${pad(s)},${pad(cs)}`
}

export function fmtTimer(ms: number): string {
  const t = Math.ceil(ms / 1000)
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = t % 60
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

