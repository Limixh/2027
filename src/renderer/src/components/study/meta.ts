import type { StudySession } from '../../../../shared/types'
import { SUBJECT_MAP } from '@/data/curriculum'

export type SessionKind = NonNullable<StudySession['kind']>

export const KIND_LABEL: Record<SessionKind, string> = {
  konu: 'Konu',
  soru: 'Soru',
  tekrar: 'Tekrar',
  deneme: 'Deneme',
  diger: 'Diğer'
}

export const KIND_COLOR: Record<SessionKind, string> = {
  konu: '#6366f1',
  soru: '#10b981',
  tekrar: '#f59e0b',
  deneme: '#ef4444',
  diger: '#64748b'
}

/** Dersi olmayan oturumlar için nötr renk */
export const OTHER_COLOR = '#8b93a7'

export const subjectColor = (id?: string): string => (id && SUBJECT_MAP[id]?.color) || OTHER_COLOR

export const subjectName = (id?: string): string => (id && SUBJECT_MAP[id]?.name) || 'Dersiz'

/** Hem TYT hem AYT'de aynı adı taşıyan dersleri ayırt etmek için "TYT Matematik" biçimi */
export const subjectFullName = (id?: string): string => {
  const s = id ? SUBJECT_MAP[id] : undefined
  return s ? `${s.exam} ${s.name}` : 'Dersiz'
}

/** Grafik / rozet etiketi */
export const subjectShortFull = (id?: string): string => {
  const s = id ? SUBJECT_MAP[id] : undefined
  return s ? `${s.exam} ${s.short}` : 'Dersiz'
}
