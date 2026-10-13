import type { ExamResult, ExamType, Settings, Subject, SubjectScore } from '../../../../shared/types'
import { SUBJECTS, SUBJECT_MAP } from '@/data/curriculum'
import { estimateField, estimateTyt, net, placement, round2, tytGroupNets, totalNet } from '@/lib/exam'
import { sortedExams } from '@/lib/stats'

export const TYT_GROUP_META = [
  { key: 'turkce', label: 'Türkçe', color: '#ef4444' },
  { key: 'sosyal', label: 'Sosyal', color: '#f59e0b' },
  { key: 'matematik', label: 'Matematik', color: '#6366f1' },
  { key: 'fen', label: 'Fen', color: '#10b981' }
] as const

/** Deneme içindeki dersler (müfredat sırasıyla) */
export function examSubjects(exam: ExamResult): Subject[] {
  return SUBJECTS.filter((s) => exam.scores[s.id])
}

export const scoreTotal = (s: SubjectScore): number => s.correct + s.wrong + s.blank

/** Ders başarısı 0..1 (net / soru sayısı) */
export function successRatio(s: SubjectScore | undefined, subjectId: string): number {
  if (!s) return 0
  const qc = Math.max(SUBJECT_MAP[subjectId]?.questionCount ?? 0, scoreTotal(s), 1)
  return Math.max(0, net(s)) / qc
}

export function previousExams(exam: ExamResult, all: ExamResult[]): ExamResult[] {
  const list = sortedExams(all, exam.type)
  const idx = list.findIndex((e) => e.id === exam.id)
  return idx <= 0 ? [] : list.slice(0, idx)
}

export interface Estimate {
  raw: number
  place: number
  label: string
}

/** Tahmini puan: TYT için doğrudan; AYT için en yakın TYT denemesiyle birlikte alan puanı */
export function estimateFor(exam: ExamResult, all: ExamResult[], settings: Settings): Estimate | null {
  if (exam.type === 'TYT') {
    const raw = estimateTyt(tytGroupNets(exam))
    return { raw, place: placement(raw, settings.obp), label: 'TYT puanı' }
  }
  if (settings.field === 'DIL') return null
  const fieldSubjects = SUBJECTS.filter((s) => s.exam === 'AYT' && s.fields.includes(settings.field))
  if (!fieldSubjects.some((s) => exam.scores[s.id])) return null
  const tyts = sortedExams(all, 'TYT')
  if (!tyts.length) return null
  const before = tyts.filter((t) => t.date <= exam.date)
  const tyt = before.length ? before[before.length - 1] : tyts[tyts.length - 1]
  const raw = estimateField(settings.field, tytGroupNets(tyt), exam)
  if (raw === null) return null
  return { raw, place: placement(raw, settings.obp), label: 'Alan puanı' }
}

export interface TypeStats {
  count: number
  avg: number
  best: ExamResult | null
  bestNet: number
  last5: number
  trend: number | null
  trendHint: string
}

export function typeStats(exams: ExamResult[], type: ExamType): TypeStats {
  const list = sortedExams(exams, type)
  const nets = list.map((e) => totalNet(e))
  const mean = (a: number[]): number => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0)
  let best: ExamResult | null = null
  let bestNet = 0
  list.forEach((e, i) => {
    if (!best || nets[i] > bestNet) {
      best = e
      bestNet = nets[i]
    }
  })
  let trend: number | null = null
  let trendHint = 'en az 2 deneme gerekir'
  if (nets.length >= 2) {
    if (nets.length >= 4) {
      const k = Math.min(3, Math.floor(nets.length / 2))
      trend = round2(mean(nets.slice(-k)) - mean(nets.slice(-2 * k, -k)))
      trendHint = `son ${k} / önceki ${k} ortalaması`
    } else {
      trend = round2(nets[nets.length - 1] - nets[0])
      trendHint = 'ilk denemeye göre'
    }
  }
  return {
    count: list.length,
    avg: round2(mean(nets)),
    best,
    bestNet,
    last5: round2(mean(nets.slice(-5))),
    trend,
    trendHint
  }
}

let counter = 0
export const mid = (): string =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `m${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 7)}`)

export const signed = (n: number, fmt: (v: number) => string): string => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n))
