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
    return `- id=${s.id} · "${s.name}"${s.area ? ` · alan: ${s.area}` : ''} · ${STATUS_LABEL[s.strength.status]} (${s.strength.score}/100)${s.description ? ` · tanım: ${s.description.slice(0, 140)}` : ''} · konular: ${s.topicIds.map(topicLabel).join(', ') || '-'}${last ? ` · son kanıtlar: ${last}` : ''}`
  })
  if (rest.length)
    lines.push(`\nDiğer beceriler (kısa katalog — bunlardan biri uyuyorsa onun id'sini kullan):\n${rest.map((s) => `- ${s.id} | ${s.name}${s.area ? ` | ${s.area}` : ''}`).join('\n')}`)
  return lines.join('\n')
}

/** Bir becerinin "tekrar zamanı" geldi mi: zayıfsa ve 3 günden uzun süredir dokunulmadıysa */
export const skillNeedsWork = (s: Skill & { strength: SkillStrength }): boolean =>
  s.strength.status === 'zayif' && (!s.strength.lastSeen || diffDays(s.strength.lastSeen, todayKey()) >= 3)
