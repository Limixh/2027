// AI Koç'un cevabındaki ```yks-actions``` bloğunu okur ve onaylanınca uygular.
// Böylece AI sadece sohbet etmez; plan oluşturur, konu durumunu günceller vb.
import type { ExamMistake, ExamType, MistakeKind, PlanTask, PlanTaskKind, SubjectScore, TopicStatus } from '../../../shared/types'
import { SUBJECT_MAP } from '@/data/curriculum'
import { formatDate, todayKey, weekdayName } from './date'
import { fmtNet, round2 } from './exam'
import { uid } from './id'
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
  | {
      type: 'exam'
      examType: string
      name?: string
      date?: string
      durationMin?: number
      scores: Record<string, { correct?: number; wrong?: number; blank?: number }>
      mistakes?: { subjectId: string; topic?: string; count?: number; kind?: string; note?: string }[]
    }

const FENCE = '```yks-actions'

/** Modelin bazen eksik bıraktığı kapanış parantezlerini tamamlar, sondaki virgülleri temizler */
export function repairJson(raw: string): string {
  const stack: string[] = []
  let inStr = false
  let esc = false
  for (const ch of raw) {
    if (inStr) {
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') inStr = true
    else if (ch === '{') stack.push('}')
    else if (ch === '[') stack.push(']')
    else if ((ch === '}' || ch === ']') && stack[stack.length - 1] === ch) stack.pop()
  }
  let out = raw.trim().replace(/,\s*$/, '')
  if (inStr) out += '"'
  out += stack.reverse().join('')
  return out.replace(/,\s*([}\]])/g, '$1')
}

function parseLoose(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return JSON.parse(repairJson(raw))
  }
}

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
    const parsed = parseLoose(rest.slice(0, end).trim()) as { actions?: unknown } | unknown[]
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
  // "Optik", "Katı Cisimler" gibi grup adları: grubun ilk konusuna bağla
  const group = subject.topics.find((t) => t.group && (fold(t.group) === q || q.includes(fold(t.group)) || fold(t.group).includes(q)))
  if (group) return group.id
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

const int = (n: unknown): number => (typeof n === 'number' && n > 0 ? Math.round(n) : 0)

/** AI'nin deneme verisini doğrulanmış biçime çevirir */
export function normalizeExam(a: Extract<AiAction, { type: 'exam' }>): {
  type: ExamType
  name: string
  date: string
  durationMin?: number
  scores: Record<string, SubjectScore>
  mistakes: ExamMistake[]
  warnings: string[]
} {
  const type: ExamType = a.examType?.toUpperCase() === 'AYT' ? 'AYT' : 'TYT'
  const warnings: string[] = []
  const scores: Record<string, SubjectScore> = {}
  for (const [id, v] of Object.entries(a.scores ?? {})) {
    const subject = SUBJECT_MAP[id]
    if (!subject || subject.exam !== type) {
      warnings.push(`Bilinmeyen ders atlandı: ${id}`)
      continue
    }
    let correct = int(v?.correct)
    let wrong = int(v?.wrong)
    let blank = int(v?.blank)
    if (correct + wrong + blank > subject.questionCount) {
      warnings.push(`${subject.name}: D+Y+B soru sayısını (${subject.questionCount}) aşıyor, kırpıldı`)
      correct = Math.min(correct, subject.questionCount)
      wrong = Math.min(wrong, subject.questionCount - correct)
      blank = Math.min(blank, subject.questionCount - correct - wrong)
    }
    scores[id] = { correct, wrong, blank }
  }
  const mistakes: ExamMistake[] = []
  for (const m of a.mistakes ?? []) {
    if (!SUBJECT_MAP[m.subjectId] || !scores[m.subjectId]) continue
    const topicId = resolveTopic(m.subjectId, m.topic)
    if (!topicId) warnings.push(`Konu eşleşmedi: ${m.topic ?? '?'}`)
    mistakes.push({
      id: uid(),
      subjectId: m.subjectId,
      topicId: topicId ?? '',
      count: Math.max(1, int(m.count)),
      kind: MISTAKE_KINDS.includes(m.kind as MistakeKind) ? (m.kind as MistakeKind) : 'bilgi',
      note: [topicId ? '' : m.topic, m.note].filter(Boolean).join(' — ') || undefined
    })
  }
  return {
    type,
    name: a.name?.trim() || `${type} denemesi`,
    date: validDate(a.date) ? a.date : todayKey(),
    durationMin: num(a.durationMin),
    scores,
    mistakes,
    warnings
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
    case 'exam': {
      const e = normalizeExam(a)
      const total = round2(Object.values(e.scores).reduce((t, s) => t + s.correct - s.wrong / 4, 0))
      return `${e.type} denemesi ekle: ${e.name} (${formatDate(e.date)}) — toplam ${fmtNet(total)} net`
    }
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
    case 'exam': {
      const e = normalizeExam(a)
      if (!Object.keys(e.scores).length) return 'Denemede geçerli ders sonucu yok'
      st.addExam({ type: e.type, name: e.name, date: e.date, durationMin: e.durationMin, scores: e.scores, mistakes: e.mistakes, note: 'AI Koç ile eklendi' })
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
