// Türetilmiş istatistikler. Hepsi saf fonksiyonlardır; bileşenlerde useMemo ile çağırın.
import type { AppData, ExamResult, ExamType, MistakeKind, StudySession, Subject } from '../../../shared/types'
import { SUBJECTS, SUBJECT_MAP, TOPIC_MAP } from '@/data/curriculum'
import { addDays, diffDays, startOfWeek, todayKey } from './date'
import { net, round2, totalNet } from './exam'

/** tarih -> toplam dakika */
export function minutesByDay(sessions: StudySession[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const s of sessions) m.set(s.date, (m.get(s.date) ?? 0) + s.minutes)
  return m
}

/** Bugünden geriye kesintisiz çalışılan gün sayısı (bugün henüz çalışılmadıysa dünden sayar) */
export function currentStreak(byDay: Map<string, number>): number {
  let day = todayKey()
  if (!byDay.get(day)) day = addDays(day, -1)
  let n = 0
  while ((byDay.get(day) ?? 0) > 0) {
    n++
    day = addDays(day, -1)
  }
  return n
}

export function longestStreak(byDay: Map<string, number>): number {
  const days = [...byDay.entries()].filter(([, m]) => m > 0).map(([d]) => d).sort()
  let best = 0
  let cur = 0
  let prev = ''
  for (const d of days) {
    cur = prev && diffDays(prev, d) === 1 ? cur + 1 : 1
    best = Math.max(best, cur)
    prev = d
  }
  return best
}

export function sumRange(byDay: Map<string, number>, from: string, to: string): number {
  let total = 0
  for (const [d, m] of byDay) if (d >= from && d <= to) total += m
  return total
}

export function thisWeekMinutes(byDay: Map<string, number>): number {
  const t = todayKey()
  return sumRange(byDay, startOfWeek(t), t)
}

/** Son n günün [{date, minutes}] dizisi (eskiden yeniye) */
export function lastNDays(byDay: Map<string, number>, n: number): { date: string; minutes: number }[] {
  const t = todayKey()
  return Array.from({ length: n }, (_, i) => {
    const date = addDays(t, i - n + 1)
    return { date, minutes: byDay.get(date) ?? 0 }
  })
}

/** Ders bazında toplam süre ve soru */
export function bySubject(sessions: StudySession[]): Map<string, { minutes: number; solved: number; correct: number; wrong: number }> {
  const m = new Map<string, { minutes: number; solved: number; correct: number; wrong: number }>()
  for (const s of sessions) {
    const key = s.subjectId ?? 'diger'
    const cur = m.get(key) ?? { minutes: 0, solved: 0, correct: 0, wrong: 0 }
    cur.minutes += s.minutes
    cur.solved += s.solved ?? 0
    cur.correct += s.correct ?? 0
    cur.wrong += s.wrong ?? 0
    m.set(key, cur)
  }
  return m
}

/** Konu bazında çözülen soru (oturumlardan) */
export function solvedByTopic(sessions: StudySession[]): Map<string, { solved: number; correct: number; wrong: number; minutes: number }> {
  const m = new Map<string, { solved: number; correct: number; wrong: number; minutes: number }>()
  for (const s of sessions) {
    if (!s.topicId) continue
    const cur = m.get(s.topicId) ?? { solved: 0, correct: 0, wrong: 0, minutes: 0 }
    cur.solved += s.solved ?? 0
    cur.correct += s.correct ?? 0
    cur.wrong += s.wrong ?? 0
    cur.minutes += s.minutes
    m.set(s.topicId, cur)
  }
  return m
}

export const sortedExams = (exams: ExamResult[], type?: ExamType): ExamResult[] =>
  exams
    .filter((e) => !type || e.type === type)
    .slice()
    .sort((a, b) => (a.date === b.date ? a.createdAt.localeCompare(b.createdAt) : a.date.localeCompare(b.date)))

/** Deneme grafiği için: her deneme için toplam net + ders netleri */
export function examSeries(exams: ExamResult[], type: ExamType): Record<string, number | string>[] {
  return sortedExams(exams, type).map((e) => {
    const row: Record<string, number | string> = { id: e.id, date: e.date, name: e.name, total: totalNet(e) }
    for (const id of Object.keys(e.scores)) row[id] = round2(net(e.scores[id]))
    return row
  })
}

/** Ders bazında ortalama net ve başarı oranı (son n deneme) */
export function subjectAverages(exams: ExamResult[], type: ExamType, lastN = 5): { subject: Subject; avgNet: number; accuracy: number; count: number; trend: number }[] {
  const list = sortedExams(exams, type)
  const recent = list.slice(-lastN)
  const prev = list.slice(-lastN * 2, -lastN)
  const out: { subject: Subject; avgNet: number; accuracy: number; count: number; trend: number }[] = []
  for (const subject of SUBJECTS.filter((s) => s.exam === type)) {
    const rs = recent.filter((e) => e.scores[subject.id])
    if (!rs.length) continue
    const avg = rs.reduce((a, e) => a + net(e.scores[subject.id]), 0) / rs.length
    const answered = rs.reduce((a, e) => a + e.scores[subject.id].correct + e.scores[subject.id].wrong, 0)
    const correct = rs.reduce((a, e) => a + e.scores[subject.id].correct, 0)
    const ps = prev.filter((e) => e.scores[subject.id])
    const prevAvg = ps.length ? ps.reduce((a, e) => a + net(e.scores[subject.id]), 0) / ps.length : avg
    out.push({
      subject,
      avgNet: round2(avg),
      accuracy: answered ? correct / answered : 0,
      count: rs.length,
      trend: round2(avg - prevAvg)
    })
  }
  return out
}

export interface TopicWeakness {
  topicId: string
  subjectId: string
  topicName: string
  subjectName: string
  /** Denemelerdeki toplam yanlış/boş soru sayısı */
  examMistakes: number
  /** Hata defterindeki çözülmemiş not sayısı */
  openNotes: number
  /** Çalışma oturumlarındaki yanlış */
  practiceWrong: number
  practiceSolved: number
  kinds: Partial<Record<MistakeKind, number>>
  lastSeen: string
  /** Öncelik puanı — büyük olan daha acil */
  score: number
}

/**
 * Hangi konularda zayıfım? Deneme hata kayıtları, hata defteri, soru çözüm doğruluğu
 * ve konu durumu birleştirilerek öncelik puanı hesaplanır. Son denemeler daha ağırlıklıdır.
 */
export function topicWeaknesses(data: AppData): TopicWeakness[] {
  const map = new Map<string, TopicWeakness>()
  const today = todayKey()
  const get = (topicId: string, subjectId: string): TopicWeakness => {
    let w = map.get(topicId)
    if (!w) {
      const t = TOPIC_MAP[topicId]
      w = {
        topicId,
        subjectId,
        topicName: t?.name ?? topicId,
        subjectName: SUBJECT_MAP[subjectId]?.name ?? subjectId,
        examMistakes: 0,
        openNotes: 0,
        practiceWrong: 0,
        practiceSolved: 0,
        kinds: {},
        lastSeen: '',
        score: 0
      }
      map.set(topicId, w)
    }
    return w
  }
  // Zaman ağırlığı: 0 gün -> 1, 60 gün -> ~0.37
  const decay = (date: string): number => Math.exp(-Math.max(0, diffDays(date, today)) / 60)

  for (const e of data.exams) {
    for (const m of e.mistakes ?? []) {
      if (!m.topicId) continue
      const w = get(m.topicId, m.subjectId)
      w.examMistakes += m.count
      w.kinds[m.kind] = (w.kinds[m.kind] ?? 0) + m.count
      w.score += m.count * (m.kind === 'bilgi' ? 1.3 : 1) * decay(e.date) * 2
      if (e.date > w.lastSeen) w.lastSeen = e.date
    }
  }
  for (const n of data.mistakeNotes) {
    if (!n.topicId) continue
    const w = get(n.topicId, n.subjectId)
    if (!n.resolved) {
      w.openNotes++
      w.score += 1.5 * decay(n.date)
    }
    w.kinds[n.kind] = (w.kinds[n.kind] ?? 0) + 1
    if (n.date > w.lastSeen) w.lastSeen = n.date
  }
  for (const s of data.sessions) {
    if (!s.topicId || !s.subjectId || !s.solved) continue
    const w = get(s.topicId, s.subjectId)
    w.practiceSolved += s.solved
    w.practiceWrong += s.wrong ?? 0
    if (s.date > w.lastSeen) w.lastSeen = s.date
  }
  for (const w of map.values()) {
    if (w.practiceSolved >= 10) {
      const errRate = w.practiceWrong / w.practiceSolved
      w.score += errRate * 6
    }
    const status = data.topicProgress[w.topicId]?.status ?? 0
    // Konu hiç çalışılmadıysa öncelik artar, pekiştiyse azalır
    w.score *= [1.3, 1.15, 1, 0.9, 0.75][status]
    w.score = round2(w.score)
  }
  return [...map.values()].filter((w) => w.score > 0).sort((a, b) => b.score - a.score)
}

/** Ders bazında konu ilerleme yüzdesi (durum puanı / maksimum) */
export function subjectProgress(data: AppData, subject: Subject): { pct: number; done: number; total: number } {
  const total = subject.topics.length
  let pts = 0
  let done = 0
  for (const t of subject.topics) {
    const st = data.topicProgress[t.id]?.status ?? 0
    pts += st
    if (st >= 2) done++
  }
  return { pct: total ? pts / (total * 4) : 0, done, total }
}

export function overallProgress(data: AppData, exam?: ExamType): { pct: number; done: number; total: number } {
  let pts = 0
  let total = 0
  let done = 0
  for (const s of SUBJECTS) {
    if (exam && s.exam !== exam) continue
    for (const t of s.topics) {
      const st = data.topicProgress[t.id]?.status ?? 0
      pts += st
      total++
      if (st >= 2) done++
    }
  }
  return { pct: total ? pts / (total * 4) : 0, done, total }
}

/** Aralıklı tekrar: son tekrardan bu yana geçmesi gereken gün (tekrar sayısına göre artar) */
const REVIEW_INTERVALS = [1, 3, 7, 14, 30, 60]

export function reviewsDue(data: AppData): { topicId: string; subjectId: string; due: string; overdue: number }[] {
  const today = todayKey()
  const out: { topicId: string; subjectId: string; due: string; overdue: number }[] = []
  for (const [topicId, p] of Object.entries(data.topicProgress)) {
    if (p.status < 2 || !p.lastReview) continue
    const interval = REVIEW_INTERVALS[Math.min(p.reviews ?? 0, REVIEW_INTERVALS.length - 1)]
    const due = addDays(p.lastReview, interval)
    if (due <= today) {
      const t = TOPIC_MAP[topicId]
      if (!t) continue
      out.push({ topicId, subjectId: t.subjectId, due, overdue: diffDays(due, today) })
    }
  }
  return out.sort((a, b) => b.overdue - a.overdue)
}

export const daysUntil = (dateKey: string): number => diffDays(todayKey(), dateKey)
