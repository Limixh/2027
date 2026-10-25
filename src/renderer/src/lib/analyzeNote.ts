// Hata defterindeki bir soruyu AI ile analiz eder; sonucu nota yazar ve becerileri İkinci Beyin'e işler.
// Hem soru detayından (tek tek) hem toplu analizden kullanılır.
import type { MistakeKind, MistakeNote } from '../../../shared/types'
import { SUBJECT_MAP, TOPIC_MAP } from '@/data/curriculum'
import { TUTOR_SYSTEM, analysisPrompt, askAiWithModel, splitNoteMeta } from './aiRunner'
import { resolveTopic } from './aiActions'
import { memoryForPrompt } from './brain'
import { maybeConsolidate } from './brainSync'
import { useStore } from './store'

/** AI'nin atayabileceği hata türleri; "çözüme bakarak" yalnızca öğrencinin kendi işaretinden gelir */
const AI_KINDS: MistakeKind[] = ['bilgi', 'dikkat', 'sure', 'yorum', 'bos']

/** Toplu analize uygun: ders seçilmiş, görseli ya da metni olan, henüz analiz edilmemiş, gelen kutusunda olmayan */
export const notesToAnalyze = (notes: MistakeNote[]): MistakeNote[] =>
  notes.filter((n) => !n.aiAnalysis && !n.inbox && !!n.subjectId && ((n.questionImages?.length ?? 0) > 0 || !!n.text.trim()))

export async function analyzeNote(id: string, onText?: (full: string) => void): Promise<void> {
  const note = useStore.getState().data.mistakeNotes.find((m) => m.id === id)
  if (!note) return
  const subject = SUBJECT_MAP[note.subjectId]
  const topic = note.topicId ? TOPIC_MAP[note.topicId] : undefined
  const imgs = [...(note.questionImages ?? []), ...(note.attemptImages ?? [])]
  const { text: full, model } = await askAiWithModel({
    system: TUTOR_SYSTEM,
    prompt: analysisPrompt({
      subject: subject?.name ?? 'YKS',
      topic: topic?.name,
      hasAttempt: (note.attemptImages?.length ?? 0) > 0,
      note: note.text || undefined,
      correctAnswer: note.correctAnswer,
      myAnswer: note.myAnswer,
      usedSolution: note.usedSolution,
      usedHint: note.usedHint,
      hintSeen: note.hintSeen,
      comments: note.comments,
      memory: memoryForPrompt(useStore.getState().data, { subjectId: note.subjectId, topicId: note.topicId }) || undefined
    }),
    attachments: imgs.length ? imgs : undefined,
    onText
  })
  const { body, meta } = splitNoteMeta(full)
  const patch: Partial<MistakeNote> = { aiAnalysis: body, aiAnalyzedAt: new Date().toISOString(), aiModel: model }
  const cur = useStore.getState().data.mistakeNotes.find((m) => m.id === id)
  if (meta && cur) {
    // Öğrenci çözüme baktıysa tür "çözüme bakarak" kalır; değilse AI'nin bulduğu tür
    if (!cur.usedSolution && meta.kind && (AI_KINDS as string[]).includes(meta.kind)) patch.kind = meta.kind as MistakeKind
    if (meta.lesson && !cur.lesson) patch.lesson = meta.lesson
    if (!cur.topicId && meta.topic) {
      const t = resolveTopic(cur.subjectId, meta.topic)
      if (t) patch.topicId = t
    }
    if (meta.summary && !cur.text.trim()) patch.text = meta.summary
  }
  useStore.getState().updateMistakeNote(id, patch)
  // (konu güncellendikten sonra) İkinci Beyin: becerileri hafızaya işle (farklı konulardaki aynı beceri burada buluşur)
  if (meta?.skills?.length) {
    useStore.getState().applySkillAnalysis(id, meta.skills.filter((x) => x && typeof x.name === 'string'))
    void maybeConsolidate()
  }
}
