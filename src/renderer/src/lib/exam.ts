import type { ExamResult, Field, SubjectScore } from '../../../shared/types'

export const net = (s?: SubjectScore): number => (s ? s.correct - s.wrong / 4 : 0)

export const round2 = (n: number): number => Math.round(n * 100) / 100

export function fmtNet(n: number): string {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

export function totalNet(exam: ExamResult, subjectIds?: string[]): number {
  const ids = subjectIds ?? Object.keys(exam.scores)
  return round2(ids.reduce((sum, id) => sum + net(exam.scores[id]), 0))
}

export function totals(exam: ExamResult): SubjectScore & { net: number } {
  let correct = 0
  let wrong = 0
  let blank = 0
  for (const s of Object.values(exam.scores)) {
    correct += s.correct
    wrong += s.wrong
    blank += s.blank
  }
  return { correct, wrong, blank, net: round2(correct - wrong / 4) }
}

/** TYT testleri ve dersleri */
export const TYT_GROUPS = {
  turkce: ['tyt-turkce'],
  sosyal: ['tyt-tarih', 'tyt-cografya', 'tyt-felsefe', 'tyt-din'],
  matematik: ['tyt-matematik', 'tyt-geometri'],
  fen: ['tyt-fizik', 'tyt-kimya', 'tyt-biyoloji']
} as const

/** Yaklaşık puan katsayıları (geçmiş yılların ortalamasına dayalı tahmini değerler). */
const TYT_COEF = { turkce: 3.3, sosyal: 3.4, matematik: 3.3, fen: 3.4 }
const TYT_IN_AYT_COEF = { turkce: 1.32, sosyal: 1.36, matematik: 1.32, fen: 1.36 }
const AYT_COEF: Record<Exclude<Field, 'DIL'>, Record<string, number>> = {
  SAY: {
    'ayt-matematik': 3.0,
    'ayt-geometri': 3.0,
    'ayt-fizik': 2.85,
    'ayt-kimya': 3.07,
    'ayt-biyoloji': 3.07
  },
  EA: {
    'ayt-matematik': 3.0,
    'ayt-geometri': 3.0,
    'ayt-edebiyat': 3.0,
    'ayt-tarih1': 2.8,
    'ayt-cografya1': 3.33
  },
  SOZ: {
    'ayt-edebiyat': 3.0,
    'ayt-tarih1': 2.8,
    'ayt-cografya1': 3.33,
    'ayt-tarih2': 2.9,
    'ayt-cografya2': 2.9,
    'ayt-felsefe': 3.0,
    'ayt-din': 3.3
  }
}

export interface TytNets {
  turkce: number
  sosyal: number
  matematik: number
  fen: number
}

export function tytGroupNets(exam: ExamResult): TytNets {
  return {
    turkce: totalNet(exam, [...TYT_GROUPS.turkce]),
    sosyal: totalNet(exam, [...TYT_GROUPS.sosyal]),
    matematik: totalNet(exam, [...TYT_GROUPS.matematik]),
    fen: totalNet(exam, [...TYT_GROUPS.fen])
  }
}

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n))

/** Ham TYT puanı (yaklaşık, 100-500) */
export function estimateTyt(n: TytNets): number {
  const raw =
    100 +
    n.turkce * TYT_COEF.turkce +
    n.sosyal * TYT_COEF.sosyal +
    n.matematik * TYT_COEF.matematik +
    n.fen * TYT_COEF.fen
  return clamp(round2(raw), 100, 500)
}

/** Ham alan puanı (SAY/EA/SÖZ) — TYT'nin %40, AYT'nin %60 katkısıyla (yaklaşık) */
export function estimateField(field: Field, tyt: TytNets, ayt: ExamResult | undefined): number | null {
  if (field === 'DIL' || !ayt) return null
  const coef = AYT_COEF[field]
  const tytPart =
    tyt.turkce * TYT_IN_AYT_COEF.turkce +
    tyt.sosyal * TYT_IN_AYT_COEF.sosyal +
    tyt.matematik * TYT_IN_AYT_COEF.matematik +
    tyt.fen * TYT_IN_AYT_COEF.fen
  let aytPart = 0
  for (const [id, c] of Object.entries(coef)) aytPart += net(ayt.scores[id]) * c
  return clamp(round2(100 + tytPart + aytPart), 100, 500)
}

/** Yerleştirme puanı = ham puan + OBP × 0,12 */
export const placement = (raw: number, obp: number): number => round2(raw + obp * 0.12)

export const FIELD_LABEL: Record<Field, string> = {
  SAY: 'Sayısal',
  EA: 'Eşit Ağırlık',
  SOZ: 'Sözel',
  DIL: 'Dil'
}

export const MISTAKE_KIND_LABEL: Record<string, string> = {
  bilgi: 'Bilgi eksiği',
  dikkat: 'Dikkat hatası',
  sure: 'Süre yetmedi',
  yorum: 'Yorum/Soru kökü',
  bos: 'Boş bıraktım'
}

export const MISTAKE_KIND_COLOR: Record<string, string> = {
  bilgi: '#c46e6e',
  dikkat: '#bd934c',
  sure: '#4e99bb',
  yorum: '#9a6bc7',
  bos: '#7b838f'
}
