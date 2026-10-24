// İkinci Beyin: beceri gücü hesabı ve AI'ye verilecek hafıza özeti.
import type { AppData, Skill } from '../../../shared/types'
import { SUBJECT_MAP, TOPIC_MAP } from '@/data/curriculum'
import { diffDays, todayKey } from './date'

export type SkillStatus = 'zayif' | 'gelisiyor' | 'guclu'

export interface SkillStrength {
  /** 0 (çok zayıf) – 100 (oturmuş) */
  score: number
  status: SkillStatus
  misses: number
  wins: number
  lastSeen: string
  /** Becerinin görüldüğü farklı dersler */
  subjects: string[]
}

export const STATUS_LABEL: Record<SkillStatus, string> = { zayif: 'Zayıf', gelisiyor: 'Gelişiyor', guclu: 'Oturdu' }
export const STATUS_COLOR: Record<SkillStatus, string> = { zayif: '#c46e6e', gelisiyor: '#bd934c', guclu: '#5f9e7a' }

/**
 * Güç: 50'den başlar; eksik −22, zayıf −11, başarı +16. Eski kanıtların etkisi azalır (yarı ömür 45 gün),
 * böylece son durum öne çıkar ama geçmiş hatalar hemen silinmez.
 */
export function skillStrength(s: Skill, today = todayKey()): SkillStrength {
  let score = 50
  let misses = 0
  let wins = 0
  let lastSeen = ''
  for (const e of s.evidence) {
    const age = Math.max(0, diffDays(e.date, today))
    const w = Math.pow(0.5, age / 45)
    if (e.kind === 'eksik') {
      score -= 22 * w
      misses++
    } else if (e.kind === 'zayif') {
      score -= 11 * w
      misses++
    } else {
      score += 16 * w
      wins++
    }
    if (e.date > lastSeen) lastSeen = e.date
  }
  score = Math.max(0, Math.min(100, Math.round(score)))
  const subjects = [...new Set(s.topicIds.map((t) => TOPIC_MAP[t]?.subjectId).filter(Boolean) as string[])]
  return { score, status: score < 40 ? 'zayif' : score < 70 ? 'gelisiyor' : 'guclu', misses, wins, lastSeen, subjects }
}

export function sortedSkills(data: AppData): (Skill & { strength: SkillStrength })[] {
  return data.skills
    .map((s) => ({ ...s, strength: skillStrength(s) }))
    .sort((a, b) => a.strength.score - b.strength.score || b.strength.lastSeen.localeCompare(a.strength.lastSeen))
}

const topicLabel = (id: string): string => {
  const t = TOPIC_MAP[id]
  return t ? `${SUBJECT_MAP[t.subjectId]?.short ?? ''} ${t.name}`.trim() : id
}

/**
 * AI'ye verilen hafıza. İki kısım:
 * 1) En ilgili becerilerin ayrıntısı (aynı konu > aynı ders > en zayıf), son kanıtlarıyla
 * 2) Geri kalan TÜM becerilerin kısa kataloğu (id | ad | alan) — AI yeni beceri uydurmak yerine
 *    var olanı tanıyıp aynı id'yi kullansın diye. Böylece aynı eksik farklı konularda birleşir.
 */
export function memoryForPrompt(data: AppData, opts: { subjectId?: string; topicId?: string; limit?: number } = {}): string {
  const limit = opts.limit ?? 25
  const list = sortedSkills(data)
  if (!list.length) return ''
  const rank = (s: (typeof list)[number]): number =>
    opts.topicId && s.topicIds.includes(opts.topicId) ? 0 : opts.subjectId && s.strength.subjects.includes(opts.subjectId) ? 1 : 2
  const ordered = list.slice().sort((a, b) => rank(a) - rank(b) || a.strength.score - b.strength.score)
  const detailed = ordered.slice(0, limit)
  const rest = ordered.slice(limit)
  const lines = detailed.map((s) => {
    const last = s.evidence
      .slice(-3)
      .map((e) => {
        const note = e.noteId ? data.mistakeNotes.find((m) => m.id === e.noteId) : undefined
        return `${e.date} ${e.kind}${e.topicId ? ` (${topicLabel(e.topicId)})` : ''}${e.detail ? `: ${e.detail.slice(0, 120)}` : ''}${note?.text ? ` [soru notu: ${note.text.slice(0, 80)}]` : ''}`
      })
      .join(' | ')
    const needs = (s.prereqIds ?? []).map((id) => list.find((x) => x.id === id)?.name).filter(Boolean)
    return `- id=${s.id} · "${s.name}"${s.area ? ` · alan: ${s.area}` : ''} · ${STATUS_LABEL[s.strength.status]} (${s.strength.score}/100)${s.description ? ` · tanım: ${s.description.slice(0, 140)}` : ''} · konular: ${s.topicIds.map(topicLabel).join(', ') || '-'}${needs.length ? ` · dayandığı beceriler: ${needs.join(', ')}` : ''}${last ? ` · son kanıtlar: ${last}` : ''}`
  })
  if (rest.length)
    lines.push(`\nDiğer beceriler (kısa katalog — bunlardan biri uyuyorsa onun id'sini kullan):\n${rest.map((s) => `- ${s.id} | ${s.name}${s.area ? ` | ${s.area}` : ''}`).join('\n')}`)
  return lines.join('\n')
}

/** Bir becerinin "tekrar zamanı" geldi mi: zayıfsa ve 3 günden uzun süredir dokunulmadıysa */
export const skillNeedsWork = (s: Skill & { strength: SkillStrength }): boolean =>
  s.strength.status === 'zayif' && (!s.strength.lastSeen || diffDays(s.strength.lastSeen, todayKey()) >= 3)

type Row = Skill & { strength: SkillStrength }

/**
 * Beceri tekrarı zamanı geldi mi: planlanmış tekrarı bugün ya da geçmişteyse;
 * hiç tekrar edilmemişse oturmamış (zayıf / gelişiyor) her beceri sıradadır.
 */
export function skillDue(s: Row, today = todayKey()): boolean {
  if (s.nextReview) return s.nextReview <= today
  return s.strength.status !== 'guclu'
}

/**
 * Bu becerinin zayıf temelleri: önkoşullardan bu beceriden daha zayıf ya da "Zayıf" olanlar.
 * Bunlar oturmadan bu beceri de oturmaz — önce bunlara çalışılmalı.
 */
export function rootCauses(s: Row, all: Row[]): Row[] {
  return (s.prereqIds ?? [])
    .map((id) => all.find((x) => x.id === id))
    .filter((p): p is Row => !!p && (p.strength.status === 'zayif' || p.strength.score < s.strength.score))
    .sort((a, b) => a.strength.score - b.strength.score)
}

/** Bu beceriye dayanan (onu önkoşul alan) beceriler */
export const dependents = (s: Skill, all: Row[]): Row[] => all.filter((x) => x.prereqIds?.includes(s.id))

/**
 * Bugünün beceri tekrarı sırası: önce başka zayıf becerilerin temeli olanlar (kök neden), sonra en zayıflar.
 * Temeli zayıf bir beceri sıradaysa temeli de (henüz sırada olmasa bile) başa eklenir.
 */
export function reviewQueue(data: AppData, limit = 5): Row[] {
  const all = sortedSkills(data)
  const due = all.filter((s) => skillDue(s))
  const ids = new Set(due.map((s) => s.id))
  for (const s of due) for (const r of rootCauses(s, all)) ids.add(r.id)
  const rootScore = (s: Row): number => all.filter((x) => ids.has(x.id) && x.prereqIds?.includes(s.id)).length
  return all
    .filter((s) => ids.has(s.id))
    .sort((a, b) => rootScore(b) - rootScore(a) || a.strength.score - b.strength.score)
    .slice(0, limit)
}

/** Genel Bakış için odak: kök nedenler önce, sonra tekrarı gelen en zayıflar */
export function focusSkills(data: AppData, n = 3): { skill: Row; reason: string }[] {
  const all = sortedSkills(data)
  const out: { skill: Row; reason: string }[] = []
  const add = (skill: Row, reason: string): void => {
    if (out.length < n && !out.some((o) => o.skill.id === skill.id)) out.push({ skill, reason })
  }
  for (const s of all.filter((x) => x.strength.status === 'zayif')) {
    const deps = dependents(s, all).filter((x) => x.strength.status !== 'guclu')
    if (deps.length) add(s, `${deps.length} becerinin temeli`)
  }
  for (const s of all) if (skillDue(s) && s.strength.status === 'zayif') add(s, s.topicIds.length > 1 ? `${s.topicIds.length} konuda çıktı` : 'Tekrar zamanı')
  for (const s of all) if (s.strength.status === 'gelisiyor') add(s, 'Oturmak üzere')
  return out
}
