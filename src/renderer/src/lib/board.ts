// Tahtada çözüm: AI soruyu bir öğretmenin tahtada çözdüğü gibi adımlara böler (JSON);
// uygulama bunu el yazısıyla yazılıyormuş gibi adım adım oynatır. Görsel üretilmez.
import type { BoardLine, BoardSolution, BoardStep, MistakeNote } from '../../../shared/types'
import { SUBJECT_MAP, TOPIC_MAP } from '@/data/curriculum'
import { repairJson } from './aiActions'
import { AiError, TUTOR_SYSTEM, askAiWithModel } from './aiRunner'

function boardPrompt(note: MistakeNote, mode: BoardSolution['mode']): string {
  const subject = SUBJECT_MAP[note.subjectId]?.name ?? 'YKS'
  const topic = note.topicId ? TOPIC_MAP[note.topicId]?.name : undefined
  const hasAttempt = (note.attemptImages?.length ?? 0) > 0
  return `Ekteki ${subject}${topic ? ` (${topic})` : ''} sorusunu, bir öğretmenin TAHTADA çözdüğü gibi adım adım çöz. Öğrenci bu soruyu kendi başına çözemedi.${
    note.correctAnswer ? `\nDoğru cevap (cevap anahtarı): ${note.correctAnswer} — çözümün buna ulaşmalı.` : ''
  }${note.text.trim() ? `\nÖğrencinin notu: ${note.text.trim().slice(0, 400)}` : ''}${
    hasAttempt ? '\nGörsellerden biri öğrencinin kendi çözüm denemesi; uygun adımda onun yaptığı hatayı kırmızı notla göster.' : ''
  }${
    note.aiAnalysis
      ? mode === 'same'
        ? `\nDaha önce yaptığın analiz (aynı çözüm yolunu izle, tutarlı ol):\n<analiz>\n${note.aiAnalysis.slice(0, 5000)}\n</analiz>`
        : `\nDaha önce yaptığın analiz aşağıda. Bu sefer MÜMKÜNSE FARKLI bir yöntemle çöz (ör. cebirsel yerine şıklardan gitme, grafik / tablo, sayı verme, ters işlem, kısa yol); ilk adımda hangi yolu seçtiğini ve neden işe yaradığını söyle. Gerçekten başka mantıklı yol yoksa aynı yolu farklı bir anlatımla, daha küçük adımlarla anlat.\n<analiz>\n${note.aiAnalysis.slice(0, 5000)}\n</analiz>`
      : mode === 'different'
        ? '\nMümkünse alışılmış yoldan farklı, akılda kalıcı bir yöntemle çöz ve ilk adımda bunu söyle.'
        : ''
  }

Yalnızca JSON yaz, başka hiçbir şey yazma:
{"steps":[{"say":"...","lines":[{"text":"...","note":"...","mark":"circle","color":"blue"}],"clear":false}]}

Kurallar:
- 5-12 adım. Her adım tahtaya 1-3 KISA satır ekler (satır en fazla ~40 karakter). Öğretmen tahtaya tam cümle yazmaz: denklemler, sayılar, kısa ifadeler yazar.
- Matematiği düz metinle yaz: x^2, x^(n+1), a_1, √3, 3/4, ≠, ≤, ≥, ·, π, Δ. LaTeX KULLANMA.
- "say": öğretmenin o adımda sesli söylediği 1-2 doğal cümle (Türkçe, konuşur gibi; neden bu adımı attığını söyle). Sembol yerine okunuşu yaz ("x kare", "karekök üç").
- "note": isteğe bağlı, satırın yanına düşülen çok kısa not (en fazla ~25 karakter), ör. "iki tarafı x ile çarp".
- "mark": isteğe bağlı vurgu — circle (kritik değer / dikkat edilecek yer), underline, box (ara sonuç), strike (yanlış / elenen).
- "color": blue = sorudan alınan verilenler, red = tuzak / hata uyarısı, green = sonuç; diğerleri ink (yazma).
- İlk adım: sorunun ne istediği ve verilenler (blue). Son adım: cevap, green ve box ile (ör. "Cevap: C").
- Tahta dolunca (yaklaşık 7-8 satırdan sonra) yeni adımda "clear": true ile tahtayı sil; o adımın ilk satırı devam edilen ifadeyi tekrar yazsın.`
}

const COLORS = new Set(['ink', 'blue', 'red', 'green'])
const MARKS = new Set(['circle', 'underline', 'box', 'strike'])

/** AI çıktısını doğrular ve temizler */
export function parseBoard(text: string): BoardStep[] {
  const raw = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
  const json = JSON.parse(repairJson(raw)) as { steps?: unknown[] }
  const steps: BoardStep[] = []
  for (const s of json.steps ?? []) {
    if (!s || typeof s !== 'object') continue
    const st = s as Record<string, unknown>
    const lines: BoardLine[] = (Array.isArray(st.lines) ? st.lines : [])
      .map((l) => (typeof l === 'string' ? { text: l } : (l as Record<string, unknown>)))
      .filter((l) => l && typeof l.text === 'string' && (l.text as string).trim())
      .map((l) => ({
        text: String(l.text).trim(),
        note: typeof l.note === 'string' && l.note.trim() ? l.note.trim() : undefined,
        mark: typeof l.mark === 'string' && MARKS.has(l.mark) ? (l.mark as BoardLine['mark']) : undefined,
        color: typeof l.color === 'string' && COLORS.has(l.color) ? (l.color as BoardLine['color']) : undefined
      }))
    const say = typeof st.say === 'string' ? st.say.trim() : ''
    if (!say && !lines.length) continue
    steps.push({ say, lines, clear: st.clear === true || undefined })
  }
  if (!steps.length) throw new AiError('Tahta çözümü okunamadı, tekrar dene')
  return steps
}

export async function generateBoard(note: MistakeNote, mode: BoardSolution['mode']): Promise<BoardSolution> {
  const images = [...(note.questionImages ?? []), ...(note.attemptImages ?? [])]
  const r = await askAiWithModel({
    system: TUTOR_SYSTEM,
    prompt: boardPrompt(note, mode),
    attachments: images.length ? images : undefined
  })
  return { steps: parseBoard(r.text), mode, model: r.model, createdAt: new Date().toISOString() }
}

/** Adımları tahta sayfalarına böl ("clear" yeni sayfa başlatır): her adımın sayfa numarası */
export function pageOf(steps: BoardStep[]): number[] {
  let page = 0
  return steps.map((s, i) => (i > 0 && s.clear ? ++page : page))
}
