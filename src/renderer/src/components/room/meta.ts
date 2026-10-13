import type { PlanTaskKind, TopicStatus } from '../../../../shared/types'

export const KIND_LABEL: Record<PlanTaskKind, string> = { konu: 'Konu', soru: 'Soru', tekrar: 'Tekrar', deneme: 'Deneme', diger: 'Diğer' }
export const KIND_COLOR: Record<PlanTaskKind, string> = {
  konu: '#5b86b5',
  soru: '#b98233',
  tekrar: '#5f9473',
  deneme: '#9370b0',
  diger: '#7d848e'
}
export const KINDS: PlanTaskKind[] = ['konu', 'soru', 'tekrar', 'deneme', 'diger']

export const STATUS_LABEL: Record<TopicStatus, string> = {
  0: 'Başlanmadı',
  1: 'Çalışılıyor',
  2: 'Konu bitti',
  3: 'Soru çözüldü',
  4: 'Pekişti'
}

export const fmtHMS = (ms: number): string => {
  const t = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = t % 60
  const p = (n: number): string => String(n).padStart(2, '0')
  return h ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`
}
