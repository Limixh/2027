// Kitap istatistikleri: Hata Defteri'ndeki soruların hangi kitaptan geldiğine göre özet.
import type { MistakeKind, MistakeNote } from '../../../shared/types'
import { SUBJECT_MAP, TOPIC_MAP } from '@/data/curriculum'
import { MONTHS_SHORT, todayKey } from './date'

export interface BookSummary {
  total: number
  open: number
  learned: number
}

/** Her kitap için kısa özet (kartlar ve karşılaştırma tablosu) */
export function bookSummaries(notes: MistakeNote[]): Map<string, BookSummary> {
  const m = new Map<string, BookSummary>()
  for (const n of notes) {
    const id = n.bookRef?.bookId
    if (!id) continue
    const s = m.get(id) ?? { total: 0, open: 0, learned: 0 }
    s.total++
    if (n.resolved) s.learned++
    else s.open++
    m.set(id, s)
  }
  return m
}

export interface BookStats extends BookSummary {
  due: number
  analyzed: number
  byKind: { kind: MistakeKind; n: number }[]
  topics: { key: string; name: string; subject?: string; n: number; open: number }[]
  /** 10'ar sayfalık dilimler (sayfası girilmiş sorular) */
  pages: { from: number; to: number; n: number }[]
  /** Son 6 ay */
  months: { key: string; label: string; n: number }[]
  retries: { tries: number; solved: number }
  firstDate?: string
  lastDate?: string
}

export function bookStats(notes: MistakeNote[], bookId: string): BookStats {
  const mine = notes.filter((n) => n.bookRef?.bookId === bookId)
  const today = todayKey()
  const kinds = new Map<MistakeKind, number>()
  const topics = new Map<string, { key: string; name: string; subject?: string; n: number; open: number }>()
  const pages = new Map<number, number>()
  let retryTries = 0, retrySolved = 0
  for (const n of mine) {
    kinds.set(n.kind, (kinds.get(n.kind) ?? 0) + 1)
    const key = n.topicId ?? `ders:${n.subjectId || '-'}`
    const t = topics.get(key) ?? {
      key,
      name: n.topicId ? (TOPIC_MAP[n.topicId]?.name ?? 'Konu') : 'Konu seçilmemiş',
      subject: SUBJECT_MAP[n.subjectId]?.name,
      n: 0,
      open: 0
    }
    t.n++
    if (!n.resolved) t.open++
    topics.set(key, t)
    if (n.bookRef?.page) {
      const b = Math.floor((n.bookRef.page - 1) / 10)
      pages.set(b, (pages.get(b) ?? 0) + 1)
    }
    for (const r of n.retries ?? []) {
      retryTries++
      if (r.solved) retrySolved++
    }
  }
  // Son 6 ay
  const months: BookStats['months'] = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    months.push({ key, label: MONTHS_SHORT[d.getMonth()], n: mine.filter((n) => n.date.startsWith(key)).length })
  }
  const dates = mine.map((n) => n.date).sort()
  return {
    total: mine.length,
    open: mine.filter((n) => !n.resolved).length,
    learned: mine.filter((n) => n.resolved).length,
    due: mine.filter((n) => !n.resolved && !!n.nextReview && n.nextReview <= today).length,
    analyzed: mine.filter((n) => n.aiAnalysis).length,
    byKind: [...kinds.entries()].map(([kind, n]) => ({ kind, n })).sort((a, b) => b.n - a.n),
    topics: [...topics.values()].sort((a, b) => b.n - a.n),
    pages: [...pages.entries()].sort((a, b) => a[0] - b[0]).map(([b, n]) => ({ from: b * 10 + 1, to: b * 10 + 10, n })),
    months,
    retries: { tries: retryTries, solved: retrySolved },
    firstDate: dates[0],
    lastDate: dates[dates.length - 1]
  }
}

/** Kitap seçili notun kaynak metni: "345 AYT Kimya · s.45 · soru 7" */
export const bookSource = (title: string, page?: number, question?: number): string =>
  [title, page ? `s.${page}` : '', question ? `soru ${question}` : ''].filter(Boolean).join(' · ')
