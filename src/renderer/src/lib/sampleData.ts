// Uygulamayı denemek için gerçekçi örnek veri üretir (Ayarlar > Örnek veri yükle).
import type { AppData, ExamMistake, ExamResult, MistakeKind, StudySession, TopicStatus } from '../../../shared/types'
import { SUBJECTS, subjectsFor } from '@/data/curriculum'
import { addDays, todayKey } from './date'
import { uid } from './id'
import { emptyData } from './store'

function rng(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

export function generateSampleData(base: AppData): AppData {
  const r = rng(2027)
  const pick = <T,>(a: T[]): T => a[Math.floor(r() * a.length)]
  const today = todayKey()
  const d: AppData = { ...emptyData(), settings: { ...base.settings, name: base.settings.name || 'Öğrenci' } }
  const field = d.settings.field === 'DIL' ? 'SAY' : d.settings.field
  const studySubjects = [...subjectsFor('TYT'), ...subjectsFor('AYT', field)]
  const nowIso = new Date().toISOString()

  // Son 120 gün çalışma oturumları
  for (let i = 120; i >= 0; i--) {
    const date = addDays(today, -i)
    if (r() < 0.12) continue // boş gün
    const n = 1 + Math.floor(r() * 4)
    for (let k = 0; k < n; k++) {
      const subject = pick(studySubjects)
      const topic = pick(subject.topics)
      const minutes = pick([25, 40, 45, 50, 60, 75, 90, 120])
      const solved = r() < 0.6 ? Math.floor(10 + r() * 50) : 0
      const wrong = solved ? Math.floor(solved * (0.08 + r() * 0.25)) : 0
      const s: StudySession = {
        id: uid() + k,
        date,
        minutes,
        subjectId: subject.id,
        topicId: topic.id,
        solved: solved || undefined,
        correct: solved ? solved - wrong - Math.floor(r() * 3) : undefined,
        wrong: solved ? wrong : undefined,
        kind: solved ? 'soru' : pick(['konu', 'tekrar'] as const),
        createdAt: nowIso
      }
      d.sessions.push(s)
    }
  }

  // Denemeler
  const kinds: MistakeKind[] = ['bilgi', 'bilgi', 'dikkat', 'dikkat', 'sure', 'yorum', 'bos']
  const weakTopics = new Map<string, string[]>()
  for (const s of SUBJECTS) weakTopics.set(s.id, [pick(s.topics).id, pick(s.topics).id, pick(s.topics).id])
  const publishers = ['3D Yayınları', 'Limit', 'Bilgi Sarmal', 'Özdebir', 'Apotemi', 'Karekök', 'Endemik', 'Yayın Denizi']
  const makeExam = (type: 'TYT' | 'AYT', idx: number, total: number): ExamResult => {
    const date = addDays(today, -Math.round(((total - idx) * 100) / total) - (type === 'TYT' ? 1 : 0))
    const progress = idx / total
    const scores: ExamResult['scores'] = {}
    const mistakes: ExamMistake[] = []
    for (const s of type === 'TYT' ? subjectsFor('TYT') : subjectsFor('AYT', field)) {
      const skill = 0.45 + progress * 0.25 + (r() - 0.5) * 0.2
      const correct = Math.max(0, Math.min(s.questionCount, Math.round(s.questionCount * skill)))
      const rest = s.questionCount - correct
      const wrong = Math.round(rest * (0.4 + r() * 0.4))
      const blank = rest - wrong
      scores[s.id] = { correct, wrong, blank }
      let remaining = wrong + blank
      const wt = weakTopics.get(s.id)!
      while (remaining > 0 && r() < 0.85) {
        const count = Math.min(remaining, 1 + Math.floor(r() * 3))
        mistakes.push({
          id: uid(),
          subjectId: s.id,
          topicId: r() < 0.6 ? pick(wt) : pick(s.topics).id,
          count,
          kind: pick(kinds)
        })
        remaining -= count
      }
    }
    return { id: uid(), type, name: pick(publishers) + ` ${type} Genel Deneme`, date, durationMin: type === 'TYT' ? 165 : 180, scores, mistakes, createdAt: nowIso }
  }
  for (let i = 1; i <= 9; i++) d.exams.push(makeExam('TYT', i, 9))
  for (let i = 1; i <= 6; i++) d.exams.push(makeExam('AYT', i, 6))

  // Konu ilerlemesi
  for (const s of studySubjects) {
    for (const t of s.topics) {
      const x = r()
      const status = (x < 0.25 ? 0 : x < 0.4 ? 1 : x < 0.6 ? 2 : x < 0.82 ? 3 : 4) as TopicStatus
      if (!status) continue
      d.topicProgress[t.id] = {
        status,
        confidence: 1 + Math.floor(r() * 5),
        reviews: Math.floor(r() * 4),
        lastReview: status >= 2 ? addDays(today, -Math.floor(r() * 40)) : undefined,
        updatedAt: nowIso
      }
    }
  }

  // Hata defteri
  const samples: [string, string, string][] = [
    ['tyt-turkce', 'Paragrafta ana düşünceyi yardımcı düşünceyle karıştırdım.', 'Ana düşünce tüm paragrafı kapsamalı; önce paragrafın sonuna bak.'],
    ['tyt-matematik', 'Kök içinde negatif sayı işaretini atladım.', 'Mutlak değer ve kök işaretlerinde işaret kontrolünü en son tekrar yap.'],
    ['tyt-kimya', 'Mol kavramında Avogadro sayısı ile kütleyi karıştırdım.', 'n = m/MA ve n = N/NA formüllerini birimlerle birlikte yaz.'],
    ['tyt-turkce', 'Soru kökündeki "değildir" ifadesini gözden kaçırdım.', 'Olumsuz soru köklerinin altını çiz.'],
    ['tyt-matematik', 'Kesir problemlerinde bütünü yanlış seçtim.', 'Önce bütüne x de, sonra kesirleri x cinsinden yaz.'],
    ['tyt-biyoloji', 'Hücre zarından madde geçişinde aktif taşıma ile kolaylaştırılmış difüzyonu karıştırdım.', 'ATP harcıyor mu? Taşıyıcı protein var mı? Tablo yap.']
  ]
  for (const [subjectId, text, lesson] of samples) {
    const s = SUBJECTS.find((x) => x.id === subjectId)!
    d.mistakeNotes.push({
      id: uid(),
      subjectId: s.id,
      topicId: undefined,
      text,
      lesson,
      kind: pick(kinds),
      resolved: r() < 0.3,
      source: pick(publishers),
      date: addDays(today, -Math.floor(r() * 30)),
      createdAt: nowIso
    })
  }
  return d
}
