import type { Skill, SkillEvidence } from '../../../../shared/types'
import { SUBJECT_MAP, TOPIC_MAP } from '@/data/curriculum'
import { skillStrength, type SkillStrength } from '@/lib/brain'

export type SkillRow = Skill & { strength: SkillStrength }

export const KIND_META: Record<SkillEvidence['kind'], { label: string; color: string }> = {
  eksik: { label: 'Eksik', color: '#c46e6e' },
  zayif: { label: 'Zorlandı', color: '#bd934c' },
  basari: { label: 'Başarılı', color: '#5f9e7a' }
}

/** "Mat · Parabol" */
export function topicShort(id: string): string {
  const t = TOPIC_MAP[id]
  if (!t) return id
  return `${SUBJECT_MAP[t.subjectId]?.short ?? ''} · ${t.name}`
}

/** Konuları derse göre grupla (kanıt sayısıyla) */
export function groupTopics(s: Skill): { subjectId: string; topics: { id: string; name: string; count: number }[] }[] {
  const counts = new Map<string, number>()
  for (const e of s.evidence) if (e.topicId) counts.set(e.topicId, (counts.get(e.topicId) ?? 0) + 1)
  const groups = new Map<string, { id: string; name: string; count: number }[]>()
  for (const id of s.topicIds) {
    const t = TOPIC_MAP[id]
    if (!t) continue
    const arr = groups.get(t.subjectId) ?? []
    arr.push({ id, name: t.name, count: counts.get(id) ?? 0 })
    groups.set(t.subjectId, arr)
  }
  return [...groups.entries()].map(([subjectId, topics]) => ({ subjectId, topics }))
}

/** Kanıt sırasına göre güç geçmişi (başlangıç 50 + her kanıttan sonraki değer) */
export function strengthHistory(s: Skill): number[] {
  const ev = s.evidence.slice().sort((a, b) => a.date.localeCompare(b.date))
  const pts = [50]
  for (let i = 0; i < ev.length; i++) pts.push(skillStrength({ ...s, evidence: ev.slice(0, i + 1) }, ev[i].date).score)
  return pts
}

export const isCross = (s: Skill): boolean => s.topicIds.length > 1

/** Türkçe duyarlı arama için sadeleştirme */
export const fold = (x: string): string =>
  x
    .toLocaleLowerCase('tr')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i')
