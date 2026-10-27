// Konu Ağacı: konu durumlarından XP / seviye, dal ilerlemesi ve "sıradaki" konular.
import type { AppData, Subject, Topic, TopicStatus } from '../../../shared/types'
import { reviewsDue } from './stats'

/** Her aşamanın toplam XP'si (başlanmadı → pekişti) */
export const STATUS_XP: Record<TopicStatus, number> = { 0: 0, 1: 10, 2: 25, 3: 40, 4: 60 }

/** Seviye: her seviye bir öncekinden biraz daha fazla XP ister (100, 150, 200, …) */
export function levelOf(xp: number): { level: number; into: number; need: number } {
  let level = 1
  let need = 100
  let left = xp
  while (left >= need) {
    left -= need
    level++
    need += 50
  }
  return { level, into: left, need }
}

export interface Branch {
  name: string
  topics: Topic[]
}

/** Dersin konularını dallara ayır (konu grupları, sırası korunur; grupsuz konular kendi dalında) */
export function branchesOf(s: Subject): Branch[] {
  const out: Branch[] = []
  for (const t of s.topics) {
    const name = t.group ?? 'Temel'
    const last = out[out.length - 1]
    if (last && last.name === name) last.topics.push(t)
    else out.push({ name, topics: [t] })
  }
  return out
}

export type NodeState = 'locked' | 'next' | TopicStatus

/**
 * Düğümün görünümü: durumu > 0 ise durumu; başlanmamışsa dalda kendinden önceki tüm konular
 * en az "bitti" ise "sıradaki", değilse "kilitli" (yine de tıklanabilir; yalnızca yol gösterir).
 */
export function nodeStates(branch: Branch, progress: AppData['topicProgress']): NodeState[] {
  let open = true
  return branch.topics.map((t) => {
    const st = progress[t.id]?.status ?? 0
    if (st > 0) {
      if (st < 2) open = false
      return st
    }
    const s: NodeState = open ? 'next' : 'locked'
    open = false
    return s
  })
}

export interface SubjectTree {
  xp: number
  maxXp: number
  pct: number
  counts: Record<TopicStatus, number>
  total: number
}

export function subjectTree(s: Subject, progress: AppData['topicProgress']): SubjectTree {
  const counts: Record<TopicStatus, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 }
  let xp = 0
  for (const t of s.topics) {
    const st = progress[t.id]?.status ?? 0
    counts[st]++
    xp += STATUS_XP[st]
  }
  const maxXp = s.topics.length * STATUS_XP[4]
  return { xp, maxXp, pct: maxXp ? xp / maxXp : 0, counts, total: s.topics.length }
}

/** Konu başına açık hata sayısı ve tekrar zamanı gelenler */
export function topicSignals(data: AppData): { openMistakes: Map<string, number>; due: Set<string> } {
  const openMistakes = new Map<string, number>()
  for (const n of data.mistakeNotes) if (!n.resolved && n.topicId) openMistakes.set(n.topicId, (openMistakes.get(n.topicId) ?? 0) + 1)
  return { openMistakes, due: new Set(reviewsDue(data).map((r) => r.topicId)) }
}
