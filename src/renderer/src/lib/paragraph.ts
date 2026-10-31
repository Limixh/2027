// Paragraf / anlam soruları için özel yol: soru tipi, tuzak türü, kanıt cümlesi, metin üstünde çözüm ve istatistik.
// Matematik / fen sorusundaki "hangi adımda takıldın" yerine burada "hangi cümle kanıt, seçtiğin şık neden tuzak" sorulur.
import type { AppData, MistakeNote, ParaQType, ParaReading, ParaTrap } from '../../../shared/types'
import { SUBJECT_MAP, TOPIC_MAP } from '@/data/curriculum'
import { repairJson } from './aiActions'
import { AiError, TUTOR_SYSTEM, askAiWithModel } from './aiRunner'

export const QTYPE_LABEL: Record<ParaQType, string> = {
  ana: 'Ana düşünce / konu',
  yardimci: 'Yardımcı düşünce',
  cikarim: 'Çıkarım (ulaşılabilir / ulaşılamaz)',
  anlatim: 'Anlatım biçimi / tekniği',
  yapi: 'Paragrafın yapısı (giriş, bölme)',
  akis: 'Akışı bozan cümle',
  tamamlama: 'Tamamlama / sıralama',
  sozcuk: 'Sözcükte / sözde anlam',
  cumle: 'Cümlede anlam / yorum',
  diger: 'Diğer'
}

export const TRAP_LABEL: Record<ParaTrap, string> = {
  cevapdegil: 'Metinde var ama soruya cevap değil',
  genelleme: 'Aşırı genelleme / kapsamı aşıyor',
  disari: 'Metinde olmayanı çıkarma',
  kismen: 'Kısmen doğru (bir parçası yanlış)',
  ters: 'Metnin tersini söylüyor',
  olumsuz: 'Soru kökündeki olumsuzluğu kaçırma',
  okuma: 'Metni yanlış / eksik okuma',
  diger: 'Diğer'
}

export const TRAP_HINT: Record<ParaTrap, string> = {
  cevapdegil: 'Şık metinde geçiyor diye doğru sanma; önce soru kökünün tam olarak ne istediğine bak.',
  genelleme: '“her zaman, tüm, hiçbir, en” gibi kapsamı büyüten sözcükler metindekinden geniş mi, kontrol et.',
  disari: 'Kendi bilgin ya da mantığınla değil, yalnızca metindeki cümleye dayanan şıkkı seç.',
  kismen: 'Şıkkı parçalara ayır; tek bir parçası bile metinle çelişiyorsa yanlıştır.',
  ters: 'Olumlu / olumsuz ve neden / sonuç yönünü metindeki cümleyle birebir karşılaştır.',
  olumsuz: 'Kökteki “-amaz, değildir, yoktur” ekini işaretle; dört doğru şık ararsın, bir yanlışı bulursun.',
  okuma: 'Metni ilk okumada konu + yazarın tavrı diye iki kelimeyle özetle, sonra şıklara geç.',
  diger: ''
}

const QTYPES = Object.keys(QTYPE_LABEL) as ParaQType[]
const TRAPS = Object.keys(TRAP_LABEL) as ParaTrap[]
export const isQType = (v: unknown): v is ParaQType => typeof v === 'string' && (QTYPES as string[]).includes(v)
export const isTrap = (v: unknown): v is ParaTrap => typeof v === 'string' && (TRAPS as string[]).includes(v)

/** Konu adından varsayılan soru tipi (konu "Paragrafta Yardımcı Düşünce" ise tip zaten belli) */
const TOPIC_QTYPE: [RegExp, ParaQType][] = [
  [/Ana Düşünce/, 'ana'],
  [/Yardımcı Düşünce/, 'yardimci'],
  [/Anlatım Teknik|Düşünceyi Geliştirme|Anlatım Biçim/, 'anlatim'],
  [/Paragrafta Yapı/, 'yapi'],
  [/Akışını Bozan/, 'akis'],
  [/Tamamlama|Sıralama/, 'tamamlama'],
  [/Sözcükte Anlam|Söz Yorumu/, 'sozcuk'],
  [/Cümlede Anlam|Cümle Yorumu/, 'cumle']
]

const PARA_SUBJECTS = new Set(['tyt-turkce', 'ayt-edebiyat'])
const PARA_GROUPS = new Set(['Paragraf', 'Anlam Bilgisi', 'Anlam ve Anlatım'])
const NOT_PARA = /Anlatım Bozuk|Noktalama|Yazım/

/** Konu bir okuma / anlam konusu mu (paragraf yolu açılır) */
export function isParagraphTopic(topicId?: string): boolean {
  const t = topicId ? TOPIC_MAP[topicId] : undefined
  if (!t || !PARA_SUBJECTS.has(t.subjectId)) return false
  return PARA_GROUPS.has(t.group ?? '') && !NOT_PARA.test(t.name)
}

/** Formda paragraf alanları gösterilsin mi: paragraf konusu ya da konusu seçilmemiş Türkçe sorusu */
export const paragraphFieldsFor = (subjectId: string, topicId?: string): boolean =>
  isParagraphTopic(topicId) || (subjectId === 'tyt-turkce' && !topicId)

export const isParagraphNote = (n: Pick<MistakeNote, 'topicId' | 'paragraph'>): boolean => !!n.paragraph || isParagraphTopic(n.topicId)

export function topicQType(topicId?: string): ParaQType | undefined {
  const name = topicId ? TOPIC_MAP[topicId]?.name : undefined
  if (!name || !isParagraphTopic(topicId)) return undefined
  return TOPIC_QTYPE.find(([re]) => re.test(name))?.[1]
}

/** Notun soru tipi: öğrencinin / AI'nin seçtiği, yoksa konudan */
export const noteQType = (n: MistakeNote): ParaQType | undefined => n.paragraph?.qType ?? topicQType(n.topicId)

/** "1:30", "90", "1.5 dk" → saniye */
export function parseSeconds(v: string): number | undefined {
  const s = v.trim().replace(',', '.')
  if (!s) return undefined
  const mm = s.match(/^(\d+):(\d{1,2})$/)
  if (mm) return Number(mm[1]) * 60 + Number(mm[2])
  const dk = s.match(/^(\d+(?:\.\d+)?)\s*(dk|d|m)/i)
  if (dk) return Math.round(Number(dk[1]) * 60)
  const n = Number(s.replace(/\s*(sn|s)$/i, ''))
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined
}

export const fmtSeconds = (s: number): string => (s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s} sn`)

/* ------------------------------------------------------------------ */
/* AI analizi                                                          */
/* ------------------------------------------------------------------ */

export function paragraphPrompt(p: {
  note: MistakeNote
  memory?: string
}): string {
  const n = p.note
  const subject = SUBJECT_MAP[n.subjectId]?.name ?? 'Türkçe'
  const topic = n.topicId ? TOPIC_MAP[n.topicId]?.name : undefined
  const para = n.paragraph
  const qType = para?.qType && !para.qTypeAuto ? para.qType : undefined
  const facts = [
    qType ? `Öğrencinin belirttiği soru tipi: ${QTYPE_LABEL[qType]}.` : '',
    n.correctAnswer ? `Doğru cevap (cevap anahtarından): ${n.correctAnswer} — analizin bu cevaba dayanmalı; metinden kanıtlayamıyorsan bunu açıkça söyle.` : '',
    n.myAnswer ? (n.myAnswer === 'Boş' ? 'Öğrenci soruyu boş bıraktı.' : `Öğrencinin işaretlediği şık: ${n.myAnswer}.`) : '',
    para?.between?.length ? `Öğrenci şu şıklar arasında kaldı: ${para.between.join(' ve ')}.` : '',
    para?.why ? `Öğrenci o şıkkı neden seçtiğini şöyle anlatıyor: "${para.why.slice(0, 500)}"` : '',
    para?.seconds ? `Soruya harcadığı süre: ${fmtSeconds(para.seconds)} (TYT'de paragraf sorusu için hedef ~1 dk).` : '',
    n.usedSolution ? 'Öğrenci soruyu çözüme bakarak yaptı; kendi başına bulamadığı kanıtı ve eleme mantığını öğret.' : '',
    n.usedHint ? `Öğrenci çözümün bir kısmına baktı${n.hintSeen ? `: "${n.hintSeen}"` : ''}; o kısmı onun başarısı sayma.` : '',
    n.text.trim() ? `Öğrencinin notu: ${n.text.trim().slice(0, 500)}` : '',
    n.comments?.length ? `Öğrencinin yorumları (bunlara cevap ver):\n${n.comments.map((c) => `- (${c.date}) ${c.text}`).join('\n')}` : ''
  ].filter(Boolean)

  return `Öğrenci uygulamaya YALNIZCA kendi başına çözemediği / yanlış yaptığı soruları ekler. Ekteki görsel bir ${subject}${topic ? ` (${topic})` : ''} okuma / anlam sorusu (paragraf, cümlede ya da sözcükte anlam).${
    (n.attemptImages?.length ?? 0) > 0 ? ' Görsellerden biri öğrencinin işaretlemeli / karalamalı hali.' : ''
  }
${facts.join('\n')}

Bu bir işlem sorusu değil; hatanın kaynağı "hangi adımı yapamadı" değil, "metinde neyi kaçırdı ve yanlış şık onu neden çekti". Kısa, net, öğretmen gibi yaz. Şunları başlıklarla yaz:
## Soru ne istiyor?
Soru tipini söyle (${qType ? QTYPE_LABEL[qType] : 'ana düşünce, yardımcı düşünce, çıkarım, anlatım biçimi, yapı, akışı bozan cümle, tamamlama, sözcükte / cümlede anlam'}). Soru kökünü bir cümleyle aç; kökte olumsuzluk (-amaz, değildir, yoktur) varsa **kalın** yazıp uyar.
## Kanıt cümlesi
Doğru cevabı kanıtlayan cümleyi / cümleleri paragraftan AYNEN, tırnak içinde alıntıla ve doğru şıkla nasıl örtüştüğünü tek cümleyle göster. Ana düşünce sorusuysa yazarın asıl vurgusunun hangi cümlede olduğunu ("ama, oysa, kısacası, bu yüzden" gibi dönüm sözcüklerine dikkat çekerek) göster.
${
  n.myAnswer && n.myAnswer !== 'Boş' && n.myAnswer !== n.correctAnswer
    ? `## Seçtiğin şık neden tuzak?
${n.myAnswer} şıkkının seni neden çektiğini (metinde ona benzeyen hangi ifade vardı) ve neden yanlış olduğunu açıkla. Tuzak türünü adıyla söyle: metinde var ama soruya cevap değil / aşırı genelleme / metinde olmayanı çıkarma / kısmen doğru / metnin tersini söylüyor / soru kökündeki olumsuzluğu kaçırma / metni yanlış okuma.
`
    : ''
}${
  para?.between?.length
    ? `## ${para.between.join(' ile ')} arasındaki tek fark
İki şıkkı ayıran TEK belirleyici farkı (bir sözcük, kapsam, yön ya da kanıt) söyle; diğer şıkları burada anlatma.
`
    : ''
}## Diğer şıklar
Her yanlış şık için tek satır: neden elenir.
## Bir dahaki sefere okuma stratejisi
Bu soru tipine özgü 2-3 madde: önce neye bakmalı, metinde neyi işaretlemeli, hangi şıkları hızlıca elemeli.${
  para?.seconds && para.seconds > 90 ? ' Süresi uzun olduğu için zamanı kısaltacak bir madde de ekle.' : ''
}
${
  p.memory
    ? `## Hafızadan: daha önce de olmuş mu?
Aşağıdaki beceri hafızasında aynı tuzağa ya da aynı okuma hatasına düşülmüş bir beceri GERÇEKTEN varsa adını tırnak içinde aynen kullanarak bağla; yoksa tek cümleyle geç.

<ogrencinin_beceri_hafizasi>
${p.memory}
</ogrencinin_beceri_hafizasi>
`
    : ''
}
En sonda tek bir kod bloğu ekle (dili yks-note), içinde yalnızca JSON:
{"topic":"konunun müfredattaki adı","kind":"bilgi|dikkat|sure|yorum|bos","qType":"${QTYPES.join('|')}","trap":"${TRAPS.join('|')}","summary":"hatanın tek cümlelik özeti","lesson":"akılda tutulacak tek cümle","skills":[{"id":"hafızadaki id (aynı beceriyse) ya da boş","name":"beceri adı","role":"eksik|zayif|basari","detail":"bu soruda bu becerinin rolü, 1 cümle","description":"yeni beceriyse kısa genel tanım","area":"Paragraf"}]}

qType: soru tipi (ana = ana düşünce / konu / başlık, yardimci = yardımcı düşünce / "değinilmemiştir", cikarim = "ulaşılabilir / çıkarılabilir", anlatim = anlatım biçimi / tekniği / düşünceyi geliştirme yolu, yapi = giriş cümlesi / ikiye bölme, akis = akışı bozan cümle, tamamlama = boşluk doldurma / sıralama, sozcuk = sözcükte / sözde anlam, cumle = cümlede anlam / yorum).
trap: öğrencinin seçtiği yanlış şıkkın tuzak türü (cevapdegil = metinde var ama soruya cevap değil, genelleme = kapsamı aşıyor, disari = metinde olmayanı çıkarıyor, kismen = bir parçası yanlış, ters = metnin tersi, olumsuz = kökteki olumsuzluğu kaçırdı, okuma = metni yanlış / eksik okudu); boş bıraktıysa ya da şıkkı bilinmiyorsa en olası okuma hatasını yaz.
kind: yorum = metni / soru kökünü yanlış yorumladı (paragrafta çoğu hata budur); dikkat = biliyordu ama kökü ya da bir sözcüğü atladı; sure = zaman yetmedi; bilgi = kavramı bilmiyor (ör. anlatım biçimlerinin tanımı, sözcüğün anlamı); bos = boş bıraktı.

skills kuralları: Paragrafta beceri, konu adı değil bir OKUMA STRATEJİSİ ya da TUZAĞI TANIMA becerisidir. 1-3 beceri yaz; adı yeniden kullanılabilir olsun, ör. "Metinde geçen ama soruya cevap olmayan şıkkı eleme", "Kapsamı aşan (aşırı genelleyen) şıkkı fark etme", "Soru kökündeki olumsuzluğu yakalama", "Ana düşünceyi yardımcı düşünceden ayırma", "Dönüm sözcüğünden (ama, oysa) sonra gelen asıl vurguyu bulma", "Metne dayanmayan yorumu eleme", "Anlatım biçimlerini (betimleme, öyküleme, tartışma) ayırt etme". Hafızadaki bir beceriyi YALNIZCA aynı tuzak / aynı strateji ise kullan (id ve adı aynen); değilse yeni beceri aç. role: düştüğü tuzağı tanıma / kaçırdığı strateji = eksik, arada kalıp zorlandığı = zayif, kendi doğru yaptığı (ör. doğru şıkla arada kaldıysa diğerlerini doğru elemesi) = basari. area her zaman "Paragraf".`
}

/* ------------------------------------------------------------------ */
/* Metin üstünde çözüm                                                 */
/* ------------------------------------------------------------------ */

function readingPrompt(n: MistakeNote): string {
  const para = n.paragraph
  return `Ekteki Türkçe okuma / anlam sorusunu METİN ÜSTÜNDE çöz: öğrenci paragrafı görecek, kanıt cümlesi vurgulanacak, şıklar tek tek elenecek.${
    n.correctAnswer ? `\nDoğru cevap (cevap anahtarı): ${n.correctAnswer}.` : ''
  }${n.myAnswer && n.myAnswer !== 'Boş' ? `\nÖğrencinin işaretlediği şık: ${n.myAnswer}.` : ''}${
    para?.between?.length ? `\nArada kaldığı şıklar: ${para.between.join(', ')}.` : ''
  }${n.aiAnalysis ? `\nDaha önceki analizin (tutarlı ol):\n<analiz>\n${n.aiAnalysis.slice(0, 3000)}\n</analiz>` : ''}

Yalnızca JSON yaz, başka hiçbir şey yazma:
{"passage":"...","stem":"...","evidence":["..."],"decoys":["..."],"options":[{"letter":"A","text":"...","correct":false,"reason":"...","trap":"cevapdegil"}],"steps":["..."]}

Kurallar:
- passage: paragrafı görseldeki gibi AYNEN aktar (numaralı cümleler varsa "(I)", "(II)" numaralarını koru). Soru kökünü ve şıkları passage'a KOYMA.
- stem: soru kökü, aynen.
- evidence: doğru cevabı kanıtlayan cümle(ler) ya da cümle parçaları; passage'dan HARFİ HARFİNE kopyala (vurgulanacak, bir harf farkı bile eşleşmeyi bozar). 1-2 tane.
- decoys: yanlış şıkların (özellikle öğrencinin seçtiği şıkkın) dayandığı ama soruya cevap olmayan ifadeler; passage'dan harfi harfine. Yoksa boş dizi.
- options: beş şıkkın hepsi, sırayla. text = şıkkın metni (kısaltmadan). reason = neden doğru / neden yanlış, tek kısa cümle, kanıta atıfla. trap = yalnızca yanlış şıklarda: cevapdegil | genelleme | disari | kismen | ters | olumsuz | okuma.
- steps: 3-5 kısa adım; öğrenci bu soruyu nasıl okumalıydı (ör. "Kökte 'ulaşılamaz' var: dört şık metinde olacak", "İkinci cümledeki 'ama' asıl vurguyu başlatıyor").`
}

const norm = (s: string): string =>
  s
    .replace(/[“”„«»"]/g, '"')
    .replace(/[‘’`´]/g, "'")
    .replace(/[…]/g, '...')
    .toLocaleLowerCase('tr-TR')

/** Alıntıyı paragrafta bul (boşluk / tırnak / büyük-küçük farkına dayanıklı); [başlangıç, bitiş] */
export function locate(passage: string, quote: string): [number, number] | null {
  const q = quote.trim().replace(/^["'“”]+|["'“”.…]+$/g, '').trim()
  if (q.length < 4) return null
  // normalleştirilmiş metin + her karakterin orijinaldeki indeksi
  let flat = ''
  const idx: number[] = []
  let space = false
  for (let i = 0; i < passage.length; i++) {
    const ch = passage[i]
    if (/\s/.test(ch)) {
      if (!space && flat) {
        flat += ' '
        idx.push(i)
      }
      space = true
      continue
    }
    // noktalama yok sayılır (AI alıntıda virgülü atlayabilir)
    if (/[\p{P}\p{S}]/u.test(ch)) continue
    space = false
    const c = norm(ch)
    for (const x of c) {
      flat += x
      idx.push(i)
    }
  }
  const nq = norm(q)
    .replace(/[\p{P}\p{S}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
  const tryFind = (needle: string): [number, number] | null => {
    const at = flat.indexOf(needle)
    if (at < 0) return null
    return [idx[at], idx[at + needle.length - 1] + 1]
  }
  const full = tryFind(nq)
  if (full) return full
  // AI baş / son kısmı biraz değiştirdiyse: başından ve sonundan parçalarla dene
  if (nq.length > 30) {
    const a = tryFind(nq.slice(0, 24))
    const b = tryFind(nq.slice(-24))
    if (a && b && b[1] > a[0] && b[1] - a[0] < nq.length * 1.6) return [a[0], b[1]]
    if (a) return [a[0], Math.min(passage.length, a[0] + q.length)]
  }
  return null
}

export function parseReading(text: string): Omit<ParaReading, 'model' | 'createdAt'> {
  const raw = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
  const j = JSON.parse(repairJson(raw)) as Record<string, unknown>
  const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()).map((x) => x.trim()) : [])
  const passage = typeof j.passage === 'string' ? j.passage.trim() : ''
  if (!passage) throw new AiError('Paragraf metni okunamadı, tekrar dene')
  const options = (Array.isArray(j.options) ? j.options : [])
    .filter((o): o is Record<string, unknown> => !!o && typeof o === 'object')
    .map((o, i) => ({
      letter: typeof o.letter === 'string' && o.letter.trim() ? o.letter.trim().slice(0, 2).toUpperCase() : 'ABCDE'[i] ?? String(i + 1),
      text: typeof o.text === 'string' && o.text.trim() ? o.text.trim() : undefined,
      correct: o.correct === true,
      reason: typeof o.reason === 'string' ? o.reason.trim() : '',
      trap: o.correct !== true && isTrap(o.trap) ? o.trap : undefined
    }))
  return {
    passage,
    stem: typeof j.stem === 'string' && j.stem.trim() ? j.stem.trim() : undefined,
    evidence: strs(j.evidence).slice(0, 3),
    decoys: strs(j.decoys).slice(0, 4),
    options,
    steps: strs(j.steps).slice(0, 6)
  }
}

export async function generateReading(n: MistakeNote): Promise<ParaReading> {
  const images = [...(n.questionImages ?? []), ...(n.attemptImages ?? [])]
  const r = await askAiWithModel({ system: TUTOR_SYSTEM, prompt: readingPrompt(n), attachments: images.length ? images : undefined })
  return { ...parseReading(r.text), model: r.model, createdAt: new Date().toISOString() }
}

/* ------------------------------------------------------------------ */
/* İstatistik                                                          */
/* ------------------------------------------------------------------ */

export interface ParaTypeRow {
  qType: ParaQType
  /** Soru Pratiği'nden: çözülen / doğru / toplam süre */
  solved: number
  correct: number
  seconds: number
  /** Hata defterindeki soru sayısı */
  mistakes: number
}

export interface ParagraphStats {
  rows: ParaTypeRow[]
  traps: { trap: ParaTrap; count: number }[]
  notes: number
  /** Hata defterinde süresi girilmiş soruların ortalaması (saniye) */
  avgNoteSeconds?: number
  /** Pratikte soru başına ortalama süre (saniye) */
  avgPracticeSeconds?: number
}

export function paragraphStats(data: AppData): ParagraphStats {
  const rows = new Map<ParaQType, ParaTypeRow>()
  const row = (q: ParaQType): ParaTypeRow => {
    let r = rows.get(q)
    if (!r) rows.set(q, (r = { qType: q, solved: 0, correct: 0, seconds: 0, mistakes: 0 }))
    return r
  }
  let pSolved = 0
  let pSec = 0
  for (const s of data.practiceSets ?? []) {
    const q = topicQType(s.topicId)
    if (!q || !s.count) continue
    const r = row(q)
    r.solved += s.count
    r.correct += s.correct
    r.seconds += s.seconds
    pSolved += s.count
    pSec += s.seconds
  }
  const traps = new Map<ParaTrap, number>()
  let notes = 0
  let nSec = 0
  let nSecN = 0
  for (const n of data.mistakeNotes) {
    if (!isParagraphNote(n)) continue
    notes++
    const q = noteQType(n)
    if (q) row(q).mistakes++
    const t = n.paragraph?.trap
    if (t) traps.set(t, (traps.get(t) ?? 0) + 1)
    if (n.paragraph?.seconds) {
      nSec += n.paragraph.seconds
      nSecN++
    }
  }
  return {
    rows: [...rows.values()].sort((a, b) => QTYPES.indexOf(a.qType) - QTYPES.indexOf(b.qType)),
    traps: [...traps.entries()].map(([trap, count]) => ({ trap, count })).sort((a, b) => b.count - a.count),
    notes,
    avgNoteSeconds: nSecN ? Math.round(nSec / nSecN) : undefined,
    avgPracticeSeconds: pSolved ? Math.round(pSec / pSolved) : undefined
  }
}
