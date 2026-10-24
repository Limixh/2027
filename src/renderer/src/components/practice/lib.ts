import { create } from 'zustand'
import type { PracticeSet } from '../../../../shared/types'
import { SUBJECT_MAP } from '@/data/curriculum'
import { toKey } from '@/lib/date'

export type Res = 'D' | 'Y' | 'B'

export const RES_COLOR: Record<Res, string> = {
  D: 'rgb(var(--success))',
  Y: 'rgb(var(--danger))',
  B: 'rgb(var(--subtle))'
}
export const RES_LABEL: Record<Res, string> = { D: 'Doğru', Y: 'Yanlış', B: 'Boş' }

export const DEFAULT_SUBJECT = 'tyt-turkce'
export const DEFAULT_TARGET = 72

/** Türkçe dersindeki ilk "Paragraf" konusu */
export function paragrafTopicId(): string | undefined {
  return SUBJECT_MAP[DEFAULT_SUBJECT]?.topics.find((t) => t.group === 'Paragraf' || t.name.includes('Paragraf'))?.id
}

export function isParagraf(p: Pick<PracticeSet, 'subjectId' | 'topicId'>): boolean {
  if (p.subjectId !== DEFAULT_SUBJECT) return false
  const t = SUBJECT_MAP[DEFAULT_SUBJECT]?.topics.find((x) => x.id === p.topicId)
  return !!t && (t.group === 'Paragraf' || t.name.includes('Paragraf'))
}

export const netOf = (c: number, w: number): number => c - w / 4

export function fmtNum(n: number, d = 1): string {
  return n.toLocaleString('tr-TR', { maximumFractionDigits: d })
}

/** 84 -> '1 dk 24 sn' */
export function fmtDur(sec: number): string {
  const s = Math.round(sec)
  if (s < 60) return `${s} sn`
  const m = Math.floor(s / 60)
  const r = s % 60
  return r ? `${m} dk ${r} sn` : `${m} dk`
}

/** 84 -> '1:24' */
export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  const p = (n: number): string => String(n).padStart(2, '0')
  return h ? `${h}:${p(m)}:${p(r)}` : `${m}:${p(r)}`
}

export function lsGet<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return v ? (JSON.parse(v) as T) : fallback
  } catch {
    return fallback
  }
}
export function lsSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* yok say */
  }
}

export interface DayAgg {
  date: string
  count: number
  seconds: number
  correct: number
  wrong: number
  blank: number
  avg: number
  acc: number
}

export function aggregateDays(sets: PracticeSet[]): DayAgg[] {
  const m = new Map<string, DayAgg>()
  for (const s of sets) {
    const d = m.get(s.date) ?? { date: s.date, count: 0, seconds: 0, correct: 0, wrong: 0, blank: 0, avg: 0, acc: 0 }
    d.count += s.count
    d.seconds += s.seconds
    d.correct += s.correct
    d.wrong += s.wrong
    d.blank += s.blank
    m.set(s.date, d)
  }
  return [...m.values()]
    .map((d) => ({ ...d, avg: d.count ? d.seconds / d.count : 0, acc: d.count ? (d.correct / d.count) * 100 : 0 }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/* ---------- Canlı ölçüm durumu (sayfadan çıkınca kaybolmaz) ---------- */

export interface LiveState {
  phase: 'idle' | 'running' | 'paused' | 'summary'
  subjectId: string
  topicId?: string
  planned: number
  source: string
  date: string
  times: number[]
  results: Res[]
  /** Geçerli sorunun biriken süresi (ms) */
  acc: number
  /** Çalışırken geçerli segmentin başlangıcı */
  segStart?: number
  start(p: { subjectId: string; topicId?: string; planned: number; source: string }): void
  answer(r: Res): void
  undo(): void
  pause(): void
  resume(): void
  finish(): void
  reset(): void
}

export const curMs = (s: Pick<LiveState, 'acc' | 'segStart' | 'phase'>): number =>
  s.acc + (s.phase === 'running' && s.segStart ? Date.now() - s.segStart : 0)

export const useLive = create<LiveState>((set, get) => ({
  phase: 'idle',
  subjectId: DEFAULT_SUBJECT,
  planned: 0,
  source: '',
  date: '',
  times: [],
  results: [],
  acc: 0,
  start: (p) =>
    set({ ...p, phase: 'running', date: toKey(new Date()), times: [], results: [], acc: 0, segStart: Date.now() }),
  answer: (r) => {
    const s = get()
    if (s.phase !== 'running') return
    const sec = Math.max(1, Math.round(curMs(s) / 1000))
    const times = [...s.times, sec]
    const results = [...s.results, r]
    if (s.planned > 0 && times.length >= s.planned) {
      set({ times, results, acc: 0, segStart: undefined, phase: 'summary' })
    } else set({ times, results, acc: 0, segStart: Date.now() })
  },
  undo: () => {
    const s = get()
    if (!s.times.length || (s.phase !== 'running' && s.phase !== 'paused')) return
    const last = s.times[s.times.length - 1]
    set({
      times: s.times.slice(0, -1),
      results: s.results.slice(0, -1),
      acc: last * 1000 + curMs(s),
      segStart: s.phase === 'running' ? Date.now() : undefined
    })
  },
  pause: () => {
    const s = get()
    if (s.phase === 'running') set({ acc: curMs(s), segStart: undefined, phase: 'paused' })
  },
  resume: () => {
    if (get().phase === 'paused') set({ phase: 'running', segStart: Date.now() })
  },
  finish: () => set({ phase: 'summary', acc: 0, segStart: undefined }),
  reset: () => set({ phase: 'idle', times: [], results: [], acc: 0, segStart: undefined })
}))
