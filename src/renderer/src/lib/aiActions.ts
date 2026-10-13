// AI Koç'un cevabındaki ```yks-actions``` bloğunu okur ve onaylanınca uygular.
// Böylece AI sadece sohbet etmez; plan oluşturur, konu durumunu günceller vb.
import type { MistakeKind, PlanTask, PlanTaskKind, TopicStatus } from '../../../shared/types'
import { SUBJECT_MAP } from '@/data/curriculum'
import { formatDate, todayKey, weekdayName } from './date'
import { useStore } from './store'

export interface AiPlanTask {
  title?: string
  subjectId?: string
  topic?: string
  kind?: string
  scope?: string
  completesTopic?: boolean
  targetMinutes?: number
  targetQuestions?: number
  time?: string
  note?: string
}

export type AiAction =
  | { type: 'plan'; date?: string; summary?: string; tasks: AiPlanTask[] }
  | { type: 'topic_status'; subjectId: string; topic: string; status: number }
  | { type: 'countdown'; title: string; at: string }
  | { type: 'mistake_note'; subjectId: string; topic?: string; text: string; lesson?: string; kind?: string }

const FENCE = '```yks-actions'

/** Mesajı görünen metin ve eylemler olarak ayırır. Akış sırasında blok yarımsa pending=true */
export function splitActions(content: string): { text: string; actions: AiAction[] | null; pending: boolean; error?: string } {
  const start = content.indexOf(FENCE)
  if (start < 0) return { text: content, actions: null, pending: false }
  const text = content.slice(0, start).trimEnd()
  const rest = content.slice(start + FENCE.length)
  const end = rest.indexOf('```')
  if (end < 0) return { text, actions: null, pending: true }
  const after = rest.slice(end + 3).trim()
  try {
    const parsed = JSON.parse(rest.slice(0, end).trim()) as { actions?: unknown } | unknown[]
    const list = Array.isArray(parsed) ? parsed : (parsed as { actions?: unknown }).actions
    if (!Array.isArray(list)) throw new Error('actions dizisi yok')
    const actions = list.filter((a): a is AiAction => !!a && typeof a === 'object' && typeof (a as { type?: unknown }).type === 'string')
    return { text: after ? `${text}\n\n${after}` : text, actions, pending: false }
  } catch (e) {
    return { text, actions: null, pending: false, error: `Eylem bloğu okunamadı: ${(e as Error).message}` }
  }
}

const fold = (s: string): string =>
  s
    .toLocaleLowerCase('tr')
    .replace(/[çğıöşüâîû]/g, (c) => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' })[c] ?? c)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/** Ders içinde konu adını kimliğe çevirir (tam eşleşme → içerme → kelime örtüşmesi) */
export function resolveTopic(subjectId: string | undefined, name: string | undefined): string | undefined {
  if (!subjectId || !name) return undefined
  const subject = SUBJECT_MAP[subjectId]
  if (!subject) return undefined
  const q = fold(name)
  if (!q) return undefined
  const exact = subject.topics.find((t) => fold(t.name) === q)
  if (exact) return exact.id
  const contains = subject.topics.find((t) => fold(t.name).includes(q) || q.includes(fold(t.name)))
  if (contains) return contains.id
  const words = new Set(q.split(' ').filter((w) => w.length > 2))
  let best: { id: string; score: number } | undefined
  for (const t of subject.topics) {
    const tw = fold(t.name).split(' ').filter((w) => w.length > 2)
    const score = tw.filter((w) => words.has(w)).length / Math.max(tw.length, 1)
    if (score > (best?.score ?? 0.49)) best = { id: t.id, score }
  }
  return best?.id
}

const KINDS: PlanTaskKind[] = ['konu', 'soru', 'tekrar', 'deneme', 'diger']
const MISTAKE_KINDS: MistakeKind[] = ['bilgi', 'dikkat', 'sure', 'yorum', 'bos']
const validDate = (d?: string): d is string => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d)
const num = (n: unknown): number | undefined => (typeof n === 'number' && n > 0 ? Math.round(n) : undefined)

/** AI görevini uygulamanın görev biçimine çevirir */
export function toPlanTask(t: AiPlanTask): Omit<PlanTask, 'id' | 'done'> {
  const subjectId = t.subjectId && SUBJECT_MAP[t.subjectId] ? t.subjectId : undefined
  const topicId = resolveTopic(subjectId, t.topic)
  const kind = KINDS.includes(t.kind as PlanTaskKind) ? (t.kind as PlanTaskKind) : 'diger'
  return {
    title: (t.title || t.topic || 'Görev').slice(0, 120),
    subjectId,
    topicId,
    kind,
    scope: t.scope?.trim() || undefined,
    completesTopic: typeof t.completesTopic === 'boolean' ? t.completesTopic : undefined,
    targetMinutes: num(t.targetMinutes),
    targetQuestions: num(t.targetQuestions),
    time: t.time && /^\d{1,2}:\d{2}$/.test(t.time) ? t.time.padStart(5, '0') : undefined,
    note: t.note,
    source: 'ai'
  }
}

export const planDate = (a: Extract<AiAction, { type: 'plan' }>): string => (validDate(a.date) ? a.date : todayKey())

export function describeAction(a: AiAction): string {
  switch (a.type) {
    case 'plan': {
      const d = planDate(a)
      return `${formatDate(d)} ${weekdayName(d)} için ${a.tasks.length} görevlik plan`
    }
    case 'topic_status': {
      const labels = ['Başlanmadı', 'Çalışılıyor', 'Konu bitti', 'Soru çözüldü', 'Pekişti']
      return `${SUBJECT_MAP[a.subjectId]?.name ?? a.subjectId} · ${a.topic} → ${labels[a.status] ?? a.status}`
    }
    case 'countdown':
      return `Geri sayım: ${a.title} (${a.at.replace('T', ' ')})`
    case 'mistake_note':
      return `Hata defterine not: ${SUBJECT_MAP[a.subjectId]?.name ?? ''} — ${a.text.slice(0, 60)}`
  }
}

/** Eylemi uygular; plan için mod 'replace' (mevcut planın yerine) ya da 'append' */
export function applyAction(a: AiAction, mode: 'replace' | 'append' = 'replace'): string | null {
  const st = useStore.getState()
  switch (a.type) {
    case 'plan': {
      if (!Array.isArray(a.tasks) || !a.tasks.length) return 'Planda görev yok'
      st.setPlan(planDate(a), a.tasks.map(toPlanTask), { summary: a.summary, mode })
      return null
    }
    case 'topic_status': {
      const id = resolveTopic(a.subjectId, a.topic)
      if (!id) return `Konu bulunamadı: ${a.topic}`
      st.setTopicProgress(id, { status: Math.max(0, Math.min(4, Math.round(a.status))) as TopicStatus })
      return null
    }
    case 'countdown': {
      if (!a.title || !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(a.at)) return 'Geçersiz tarih'
      st.addCountdown({ title: a.title, at: a.at.includes('T') ? a.at : `${a.at}T09:00` })
      return null
    }
    case 'mistake_note': {
      if (!SUBJECT_MAP[a.subjectId] || !a.text) return 'Geçersiz not'
      st.addMistakeNote({
        subjectId: a.subjectId,
        topicId: resolveTopic(a.subjectId, a.topic),
        text: a.text,
        lesson: a.lesson,
        kind: MISTAKE_KINDS.includes(a.kind as MistakeKind) ? (a.kind as MistakeKind) : 'bilgi',
        resolved: false,
        source: 'AI Koç',
        date: todayKey()
      })
      return null
    }
  }
}
