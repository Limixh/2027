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
  konu: '#6e70c4',
  soru: '#51b896',
  tekrar: '#bd934c',
  deneme: '#c46e6e',
  diger: '#7b838f'
}

/** Dersi olmayan oturumlar için nötr renk */
export const OTHER_COLOR = '#9296a0'

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
