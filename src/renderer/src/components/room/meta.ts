import type { PlanTaskKind, TopicStatus } from '../../../../shared/types'

export const KIND_LABEL: Record<PlanTaskKind, string> = { konu: 'Konu', soru: 'Soru', tekrar: 'Tekrar', deneme: 'Deneme', diger: 'Diğer' }
export const KINDS: PlanTaskKind[] = ['konu', 'soru', 'tekrar', 'deneme', 'diger']

export const STATUS_LABEL: Record<TopicStatus, string> = {
  0: 'Başlanmadı',
  1: 'Çalışılıyor',
  2: 'Konu bitti',
  3: 'Soru çözüldü',
  4: 'Pekişti'
}
