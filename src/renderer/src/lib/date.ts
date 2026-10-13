// Tarih yardımcıları — tüm tarihler yerel saatle 'YYYY-MM-DD' olarak tutulur.

export const pad = (n: number): string => String(n).padStart(2, '0')

export function toKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const todayKey = (): string => toKey(new Date())

export function addDays(key: string, days: number): string {
  const d = fromKey(key)
  d.setDate(d.getDate() + days)
  return toKey(d)
}

/** b - a gün farkı */
export function diffDays(a: string, b: string): number {
  return Math.round((fromKey(b).getTime() - fromKey(a).getTime()) / 86400000)
}

/** Pazartesi başlangıçlı hafta başı */
export function startOfWeek(key: string): string {
  const d = fromKey(key)
  const dow = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - dow)
  return toKey(d)
}

export function startOfMonth(key: string): string {
  return key.slice(0, 8) + '01'
}

export const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
export const MONTHS_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']
export const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar']
export const DAYS_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']

/** '13 Ekim 2026' */
export function formatDate(key: string, withYear = true): string {
  const d = fromKey(key)
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${withYear ? ' ' + d.getFullYear() : ''}`
}

/** '13 Eki' */
export function formatShort(key: string): string {
  const d = fromKey(key)
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
}

export function weekdayName(key: string): string {
  return DAYS[(fromKey(key).getDay() + 6) % 7]
}

/** 135 -> '2 sa 15 dk' */
export function formatMinutes(min: number): string {
  const m = Math.round(min)
  if (m < 60) return `${m} dk`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h} sa ${r} dk` : `${h} sa`
}

/** 135 -> '2,3 sa' */
export function formatHours(min: number, digits = 1): string {
  return `${(min / 60).toLocaleString('tr-TR', { maximumFractionDigits: digits })} sa`
}

export function relativeDay(key: string): string {
  const d = diffDays(key, todayKey())
  if (d === 0) return 'Bugün'
  if (d === 1) return 'Dün'
  if (d > 1 && d < 7) return `${d} gün önce`
  return formatDate(key, fromKey(key).getFullYear() !== new Date().getFullYear())
}
