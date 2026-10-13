import type { TopicStatus } from '../../../../shared/types'

export const STATUS_META: { value: TopicStatus; label: string; color: string }[] = [
  { value: 0, label: 'Başlanmadı', color: '#94a3b8' },
  { value: 1, label: 'Çalışılıyor', color: '#f59e0b' },
  { value: 2, label: 'Konu bitti', color: '#0ea5e9' },
  { value: 3, label: 'Soru çözüldü', color: '#8b5cf6' },
  { value: 4, label: 'Pekişti', color: '#10b981' }
]

/** Türkçe karakterlere duyarsız arama için metni sadeleştirir */
export function fold(s: string): string {
  return s
    .toLocaleLowerCase('tr')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/ü/g, 'u')
    .replace(/[̀-ͯ]/g, '')
}

export type Tier = 'wide' | 'mid' | 'narrow'

export const ROW_GRID: Record<Tier, string> = {
  wide: 'minmax(0,1fr) 206px 84px 104px 44px 176px 28px',
  mid: 'minmax(0,1fr) 100px 84px 132px 116px 28px',
  narrow: 'minmax(0,1fr) 100px 36px 28px'
}
