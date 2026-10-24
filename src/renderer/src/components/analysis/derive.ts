// Hata Analizi sayfası için türetilmiş veriler ve kural tabanlı içgörüler.
import type { AppData, ExamResult, ExamType, MistakeKind, Subject } from '../../../../shared/types'
import { SUBJECT_MAP, SUBJECTS, TOPIC_MAP } from '@/data/curriculum'
import { addDays, todayKey } from '@/lib/date'
import { MISTAKE_KIND_LABEL, net, tytGroupNets } from '@/lib/exam'
import { solvedByTopic, sortedExams, type TopicWeakness } from '@/lib/stats'

export type TypeFilter = 'ALL' | ExamType
export type Period = '30' | '90' | 'all'

export const KINDS: MistakeKind[] = ['bilgi', 'dikkat', 'sure', 'yorum', 'bos']

export const STATUS_LABEL = ['Başlanmadı', 'Çalışılıyor', 'Konu bitti', 'Soru çözüldü', 'Pekişti']
export const STATUS_COLOR = ['#7b838f', '#bd934c', '#4e99bb', '#6e70c4', '#51b896']

/** Seçili sınav türü ve döneme göre AppData kopyası üretir. */
export function filterData(data: AppData, type: TypeFilter, period: Period): AppData {
  const cutoff = period === 'all' ? '' : addDays(todayKey(), -Number(period))
  const okType = (subjectId?: string): boolean => {
    if (type === 'ALL') return true
    if (!subjectId) return false
    return SUBJECT_MAP[subjectId]?.exam === type
  }
  const okDate = (d: string): boolean => !cutoff || d >= cutoff
  return {
    ...data,
    exams: data.exams.filter((e) => (type === 'ALL' || e.type === type) && okDate(e.date)),
    mistakeNotes: data.mistakeNotes.filter((n) => okType(n.subjectId) && okDate(n.date)),
    sessions: data.sessions.filter((s) => okType(s.subjectId) && okDate(s.date))
  }
}

export function kindTotals(exams: ExamResult[]): Record<MistakeKind, number> {
  const t: Record<MistakeKind, number> = { bilgi: 0, dikkat: 0, sure: 0, yorum: 0, bos: 0, cozum: 0 }
  for (const e of exams) for (const m of e.mistakes ?? []) t[m.kind] = (t[m.kind] ?? 0) + m.count
  return t
}

export function dominantKind(kinds: Partial<Record<MistakeKind, number>>): MistakeKind | null {
  let best: MistakeKind | null = null
  let max = 0
  for (const k of KINDS) {
    const v = kinds[k] ?? 0
    if (v > max) {
      max = v
      best = k
    }
  }
  return best
}

export interface SubjectMistakeStat {
  subject: Subject
  /** Deneme hata kayıtlarından toplam yanlış/boş soru */
  mistakes: number
  /** Skor tablosundan */
  wrong: number
  blank: number
  total: number
  exams: number
}

/** Ders bazında yanlış/boş oranları ve hata paylaşımı */
export function subjectMistakeStats(exams: ExamResult[]): SubjectMistakeStat[] {
  const map = new Map<string, SubjectMistakeStat>()
  const get = (id: string): SubjectMistakeStat | null => {
    const subject = SUBJECT_MAP[id]
    if (!subject) return null
    let s = map.get(id)
    if (!s) {
      s = { subject, mistakes: 0, wrong: 0, blank: 0, total: 0, exams: 0 }
      map.set(id, s)
    }
    return s
  }
  for (const e of exams) {
    for (const [id, sc] of Object.entries(e.scores)) {
      const s = get(id)
      if (!s) continue
      const answered = sc.correct + sc.wrong + sc.blank
      s.wrong += sc.wrong
      s.blank += sc.blank
      s.total += answered || s.subject.questionCount
      s.exams++
    }
    for (const m of e.mistakes ?? []) {
      const s = get(m.subjectId)
      if (s) s.mistakes += m.count
    }
  }
  return [...map.values()]
}

export interface TopicMistakeStat {
  topicId: string
  subjectId: string
  name: string
  count: number
  /** Kaç farklı denemede göründü */
  exams: number
}

export function topicMistakeStats(exams: ExamResult[]): TopicMistakeStat[] {
  const map = new Map<string, TopicMistakeStat>()
  for (const e of exams) {
    const seen = new Set<string>()
    for (const m of e.mistakes ?? []) {
      if (!m.topicId) continue
      let t = map.get(m.topicId)
      if (!t) {
        t = {
          topicId: m.topicId,
          subjectId: m.subjectId,
          name: TOPIC_MAP[m.topicId]?.name ?? m.topicId,
          count: 0,
          exams: 0
        }
        map.set(m.topicId, t)
      }
      t.count += m.count
      if (!seen.has(m.topicId)) {
        seen.add(m.topicId)
        t.exams++
      }
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count)
}

/** Konu bazında pratik doğruluğu (en az `minSolved` soru çözülmüş) */
export function practiceAccuracy(
  data: AppData,
  minSolved = 5
): { topicId: string; subjectId: string; name: string; solved: number; accuracy: number }[] {
  const out: { topicId: string; subjectId: string; name: string; solved: number; accuracy: number }[] = []
  for (const [topicId, v] of solvedByTopic(data.sessions)) {
    if (v.solved < minSolved) continue
    const t = TOPIC_MAP[topicId]
    if (!t) continue
    out.push({
      topicId,
      subjectId: t.subjectId,
      name: t.name,
      solved: v.solved,
      accuracy: Math.max(0, Math.min(1, v.correct / v.solved))
    })
  }
  return out.sort((a, b) => a.accuracy - b.accuracy)
}

/* ------------------------------------------------------------------ */
/* İçgörüler                                                           */
/* ------------------------------------------------------------------ */

export interface Insight {
  tone: 'warn' | 'info' | 'good'
  text: string
}

const pct = (n: number): string => `%${Math.round(n * 100)}`

function avg(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0
}

/** Son 3 deneme ile bir önceki 3 deneme arasındaki değişim (oransal) */
function changeSeries(values: number[]): number | null {
  if (values.length < 3) return null
  const last = values.slice(-3)
  const prev = values.slice(-6, -3)
  if (!prev.length) return null
  const b = avg(prev)
  if (b < 3) return null
  return (avg(last) - b) / b
}

export function buildInsights(args: {
  fdata: AppData
  weak: TopicWeakness[]
  kinds: Record<MistakeKind, number>
  subjStats: SubjectMistakeStat[]
  topicStats: TopicMistakeStat[]
  practice: ReturnType<typeof practiceAccuracy>
}): Insight[] {
  const { fdata, weak, kinds, subjStats, topicStats, practice } = args
  const warn: Insight[] = []
  const good: Insight[] = []
  const info: Insight[] = []

  // 1) Baskın hata türü
  const totalKinds = KINDS.reduce((a, k) => a + kinds[k], 0)
  const dom = dominantKind(kinds)
  if (dom && totalKinds >= 5) {
    const share = kinds[dom] / totalKinds
    warn.push({
      tone: 'warn',
      text: `Hata dağılımında en büyük pay ${pct(share)} ile “${MISTAKE_KIND_LABEL[dom]}” türünde.`
    })
  }

  // 2) Net düşüşü / yükselişi
  type Change = { label: string; ch: number; count: number }
  const changes: Change[] = []
  const tyt = sortedExams(fdata.exams, 'TYT')
  if (tyt.length >= 4) {
    const groups = tyt.map(tytGroupNets)
    const names: [keyof ReturnType<typeof tytGroupNets>, string][] = [
      ['turkce', 'Türkçe'],
      ['sosyal', 'Sosyal'],
      ['matematik', 'Matematik'],
      ['fen', 'Fen']
    ]
    for (const [key, label] of names) {
      const ch = changeSeries(groups.map((g) => g[key]))
      if (ch !== null) changes.push({ label: `TYT ${label}`, ch, count: Math.min(3, tyt.length) })
    }
  }
  const ayt = sortedExams(fdata.exams, 'AYT')
  if (ayt.length >= 4) {
    for (const s of SUBJECTS.filter((x) => x.exam === 'AYT')) {
      const vals = ayt.filter((e) => e.scores[s.id]).map((e) => net(e.scores[s.id]))
      const ch = changeSeries(vals)
      if (ch !== null) changes.push({ label: s.name, ch, count: Math.min(3, vals.length) })
    }
  }
  const drop = changes.filter((c) => c.ch <= -0.1).sort((a, b) => a.ch - b.ch)[0]
  if (drop) {
    const t = drop.label.startsWith('TYT') ? 'TYT' : 'AYT'
    warn.push({
      tone: 'warn',
      text: `Son ${drop.count} ${t} denemesinde ${drop.label.replace(/^TYT /, '')} netin ${pct(-drop.ch)} düştü.`
    })
  }
  const rise = changes.filter((c) => c.ch >= 0.12).sort((a, b) => b.ch - a.ch)[0]
  if (rise) {
    const t = rise.label.startsWith('TYT') ? 'TYT' : 'AYT'
    good.push({
      tone: 'good',
      text: `Son ${rise.count} ${t} denemesinde ${rise.label.replace(/^TYT /, '')} netin ${pct(rise.ch)} yükseldi, böyle devam.`
    })
  }

  // 3) Tekrarlayan konu
  const rep = topicStats.filter((t) => t.exams >= 2).sort((a, b) => b.exams - a.exams || b.count - a.count)[0]
  if (rep) {
    warn.push({
      tone: 'warn',
      text: `${rep.name} konusunda ${rep.exams} denemede toplam ${rep.count} yanlış var; tekrar eden bir zayıflık.`
    })
  }

  // 4) Yüksek boş oranı
  const blanky = subjStats
    .filter((s) => s.total >= 20 && s.blank / s.total >= 0.18 && s.blank > s.wrong)
    .sort((a, b) => b.blank / b.total - a.blank / a.total)[0]
  if (blanky) {
    warn.push({
      tone: 'warn',
      text: `${blanky.subject.name} dersinde boş oranın yüksek (soruların ${pct(blanky.blank / blanky.total)}’i boş). Elemeli tahmin dene.`
    })
  } else {
    // yüksek yanlış oranı
    const wrongy = subjStats
      .filter((s) => s.total >= 20 && s.wrong / s.total >= 0.3)
      .sort((a, b) => b.wrong / b.total - a.wrong / a.total)[0]
    if (wrongy) {
      warn.push({
        tone: 'warn',
        text: `${wrongy.subject.name} dersinde yanlış oranın ${pct(wrongy.wrong / wrongy.total)}; emin olmadığın soruları işaretlemeden önce tekrar düşün.`
      })
    }
  }

  // 5) Çalışılmamış öncelikli konular
  const top10 = weak.slice(0, 10)
  const unstudied = top10.filter((w) => (fdata.topicProgress[w.topicId]?.status ?? 0) <= 1)
  if (unstudied.length >= 2) {
    info.push({
      tone: 'info',
      text: `İlk 10 öncelikli konudan ${unstudied.length} tanesi henüz “konu bitti” aşamasına gelmedi (${unstudied
        .slice(0, 2)
        .map((w) => w.topicName)
        .join(', ')} gibi). Önce konu eksiğini kapat.`
    })
  }

  // 6) Açık hata defteri
  const openNotes = fdata.mistakeNotes.filter((n) => !n.resolved).length
  if (openNotes >= 5) {
    info.push({
      tone: 'info',
      text: `Hata defterinde ${openNotes} çözülmemiş not bekliyor. Haftada bir tur atıp “çözüldü” olarak işaretle.`
    })
  }

  // 7) Pratik doğruluğu
  const worstPractice = practice.find((p) => p.accuracy < 0.5 && p.solved >= 10)
  if (worstPractice) {
    info.push({
      tone: 'info',
      text: `${worstPractice.name} sorularında pratik doğruluğun ${pct(worstPractice.accuracy)} (${worstPractice.solved} soru). Bu konuya özel kısa testler çöz.`
    })
  }

  // 8) En çok hata veren ders
  const bigSubj = subjStats.slice().sort((a, b) => b.mistakes - a.mistakes)[0]
  const totalMistakes = subjStats.reduce((a, s) => a + s.mistakes, 0)
  if (bigSubj && totalMistakes >= 10 && bigSubj.mistakes / totalMistakes >= 0.25) {
    info.push({
      tone: 'info',
      text: `Kayıtlı hataların ${pct(bigSubj.mistakes / totalMistakes)}’i ${bigSubj.subject.name} dersinden geliyor; çalışma planında bu derse ağırlık ver.`
    })
  }

  // Sırala: uyarılar, bilgiler, olumlu
  const all = [...warn, ...info, ...good]
  // En az bir olumlu varsa son sıraya sığdır
  const out = all.slice(0, 6)
  if (good.length && !out.includes(good[0])) out[out.length - 1] = good[0]
  return out
}

