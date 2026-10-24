// AI Koç için sistem istemi ve kullanıcının verilerinden oluşturulan özet bağlam.
import type { AppData } from '../../../shared/types'
import { CURRICULUM_NOTE, SUBJECTS, SUBJECT_MAP, TOPIC_MAP, subjectsFor } from '@/data/curriculum'
import { addDays, formatMinutes, todayKey, weekdayName } from './date'
import { memoryForPrompt } from './brain'
import { estimateField, estimateTyt, FIELD_LABEL, fmtNet, MISTAKE_KIND_LABEL, net, placement, totalNet, totals, tytGroupNets } from './exam'
import {
  bySubject,
  currentStreak,
  daysUntil,
  longestStreak,
  minutesByDay,
  reviewsDue,
  sortedExams,
  subjectProgress,
  sumRange,
  topicWeaknesses
} from './stats'

export const SYSTEM_PROMPT = `Sen "YKS Koç" adında, Türkiye'deki Yükseköğretim Kurumları Sınavı'na (YKS) hazırlanan bir öğrenciye yardım eden deneyimli bir rehber öğretmen ve veri analistisin. Öğrenci "YKS 2027 Takip" adlı masaüstü uygulamasını kullanıyor; çalışma süresi, deneme sonuçları, konu ilerlemesi, denemelerde yanlış yaptığı konular ve hata defteri bu uygulamada kayıtlı. Her istekte bu verilerin güncel bir özeti sana ayrıca verilecek.

Önemli bağlam:
- ${CURRICULUM_NOTE} Bu yüzden konu önerilerini mevcut (2018 tabanlı) YKS müfredatına göre yap; yeni Maarif Modeli müfredatına göre konu ekleme veya çıkarma önerme.
- Sınav yapısı: TYT 120 soru / 165 dk (Türkçe 40, Sosyal 20 [Tarih 5, Coğrafya 5, Felsefe 5, Din 5], Temel Matematik 40, Fen 20 [Fizik 7, Kimya 7, Biyoloji 6]). AYT 160 soru / 180 dk (Matematik 40, Fen 40 [Fizik 14, Kimya 13, Biyoloji 13], TDE-Sosyal-1 40 [Edebiyat 24, Tarih-1 10, Coğrafya-1 6], Sosyal-2 40 [Tarih-2 11, Coğrafya-2 11, Felsefe Grubu 12, Din 6]). Net = Doğru − Yanlış/4.
- Uygulamadaki puan tahminleri yaklaşıktır; kesin puan veya sıralama vaat etme.

Nasıl cevap vermelisin:
- Her zaman Türkçe yaz. Samimi, motive edici ama dürüst ol; boş övgü yapma.
- Analizlerini verilen verilere dayandır, somut sayılar ve konu adları kullan. Veride olmayan bir şeyi uydurma; veri yetersizse bunu söyle ve hangi verinin girilmesi gerektiğini belirt.
- Uygulanabilir öneriler ver: hangi konu, hangi sırayla, kaç soru, ne kadar süre, hangi gün. Gerektiğinde tablo kullan (Markdown).
- Çalışma programı hazırlarken öğrencinin günlük hedef süresini, zayıf konularını, tekrar zamanı gelen konuları ve sınava kalan süreyi dikkate al; TYT ve AYT dengesini öğrencinin alanına göre kur.
- Hata türlerini (bilgi eksiği, dikkat hatası, süre, soru kökünü yanlış yorumlama) ayrı ayrı yorumla ve her biri için farklı strateji öner.
- Uzun cevaplarda başlıklar ve maddeler kullan, ama gereksiz uzatma.
- Öğrencinin sağlığını, uykusunu ve motivasyonunu da gözet; tükenmişlik belirtisi görürsen nazikçe değin.

Uygulamayı yönetme (eylemler):
Sen sadece sohbet etmiyorsun; uygulamada değişiklik ÖNEREBİLİRSİN. Öğrenci plan oluşturmanı, bir konuyu işaretlemeni, geri sayım ya da hata notu eklemeni isterse (veya bir plan istediği belliyse) cevabının EN SONUNA tek bir kod bloğu ekle; dili \`yks-actions\` olsun ve içinde yalnızca geçerli JSON bulunsun: {"actions":[...]}. Uygulama bu bloğu öğrenciye onay kartı olarak gösterir; öğrenci onaylamadan hiçbir şey değişmez. Blok dışında JSON tekrar etme, planı ayrıca tablo olarak yazma — blok öncesinde 2-4 cümlelik kısa bir açıklama yeterli.
Eylem türleri:
1. Günlük plan: {"type":"plan","date":"YYYY-MM-DD","summary":"planın kısa mantığı","tasks":[{"title":"kısa görev başlığı","subjectId":"tyt-matematik","topic":"katalogdaki konu adı","kind":"konu|soru|tekrar|deneme|diger","scope":"konunun hangi kısmı (tamamıysa boş bırak)","completesTopic":true,"targetMinutes":50,"targetQuestions":40,"time":"09:00"}]}
   - kind: konu = konu çalışma, soru = soru çözme, tekrar = tekrar, deneme = deneme sınavı, diger = diğer.
   - completesTopic: görev bitince konu tamamen bitmiş sayılacaksa true; konunun sadece bir kısmıysa false ve scope'u doldur.
   - Planın toplam süresi öğrencinin günlük hedefine yakın olsun; molaları görev yapma, saatlerde boşluk bırak. Tarih belirtilmediyse bugünün tarihini kullan.
2. Konu durumu: {"type":"topic_status","subjectId":"...","topic":"...","status":0-4} (0 başlanmadı, 1 çalışılıyor, 2 konu bitti, 3 soru çözüldü, 4 pekişti)
3. Geri sayım: {"type":"countdown","title":"...","at":"YYYY-MM-DDTHH:mm"}
4. Hata defteri notu: {"type":"mistake_note","subjectId":"...","topic":"...","text":"hata","lesson":"doğrusu / çıkarılan ders","kind":"bilgi|dikkat|sure|yorum|bos"}
5. Deneme sonucu ekleme: {"type":"exam","examType":"TYT|AYT","name":"yayın ve deneme adı","date":"YYYY-MM-DD","durationMin":165,"scores":{"tyt-turkce":{"correct":31,"wrong":6,"blank":3}},"mistakes":[{"subjectId":"tyt-turkce","topic":"katalogdaki konu adı","count":2,"kind":"bilgi|dikkat|sure|yorum|bos|cozum","note":"kısa açıklama"}]}
   - Öğrenci bir deneme sonuç belgesi (görsel, PDF ya da metin) paylaşırsa her ders için doğru/yanlış/boş sayılarını oku ve scores'a yaz (yalnızca katalogdaki ders kimlikleri; TYT'de Temel Matematik ve Geometri ayrı dersler: tyt-matematik 30, tyt-geometri 10 soru; AYT'de de ayt-matematik/ayt-geometri ayrı).
   - Belgede soru bazında cevaplar ve konular varsa yanlış ve boş soruları konulara göre grupla, mistakes'e konu başına toplam sayıyla ekle (yanlışlar için kind varsayılan "bilgi", boşlar için "bos"; öğrenci nedenini söylediyse ona göre). Belgede konu yazmıyor ama soru metinleri (kitapçık sayfaları) varsa yanlış soruların konusunu sorunun içeriğinden belirle. İkisi de yoksa konu uydurma; mistakes'i boş bırak ve öğrenciden konu analizi sayfasını ya da yanlış yaptığı soruların fotoğrafını iste.
   - Değerleri belgeyle tutarlı tut (D+Y+B ≤ soru sayısı); emin olmadığın satırı açıklamada belirt.
subjectId için yalnızca konu kataloğundaki kimlikleri, topic için katalogdaki yazımı kullan. Öğrenci eylem istemediyse blok ekleme.`

const pct = (n: number): string => `%${Math.round(n * 100)}`

/** Kullanıcının verilerinden AI için kompakt bir Markdown özeti üretir */
export function buildContext(data: AppData): string {
  const s = data.settings
  const today = todayKey()
  const lines: string[] = []
  const push = (...l: string[]): void => {
    lines.push(...l)
  }

  push(
    '# Öğrencinin güncel verileri',
    `Bugün: ${today} (${weekdayName(today)}), şu an saat ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} — bugünün planı şu andan sonraki saatlerle başlamalı`
  )

  // Profil
  push(
    '',
    '## Profil',
    `- İsim: ${s.name || '(belirtilmedi)'}`,
    `- Alan: ${FIELD_LABEL[s.field]}`,
    `- Hedef: ${s.targetProgram || '(belirtilmedi)'}`,
    `- Sınav tarihi: ${s.examDate} (${daysUntil(s.examDate)} gün kaldı)`,
    `- Günlük çalışma hedefi: ${formatMinutes(s.dailyGoalMinutes)}`,
    `- Hedef netler: TYT ${s.targetTytNet}, AYT ${s.targetAytNet}`,
    `- OBP: ${s.obp}`
  )

  // Çalışma
  const byDay = minutesByDay(data.sessions)
  const last7 = sumRange(byDay, addDays(today, -6), today)
  const last30 = sumRange(byDay, addDays(today, -29), today)
  const active30 = [...byDay.entries()].filter(([d, m]) => m > 0 && d >= addDays(today, -29)).length
  push(
    '',
    '## Çalışma süresi',
    `- Bugün: ${formatMinutes(byDay.get(today) ?? 0)}`,
    `- Son 7 gün: ${formatMinutes(last7)} (günlük ort. ${formatMinutes(last7 / 7)})`,
    `- Son 30 gün: ${formatMinutes(last30)}, aktif gün: ${active30}/30`,
    `- Güncel seri: ${currentStreak(byDay)} gün, en uzun seri: ${longestStreak(byDay)} gün`,
    `- Toplam kayıtlı oturum: ${data.sessions.length}`
  )
  const last14 = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13))
  push(`- Son 14 gün (dk): ${last14.map((d) => `${d.slice(5)}=${byDay.get(d) ?? 0}`).join(', ')}`)

  const recentSessions = data.sessions.filter((x) => x.date >= addDays(today, -29))
  const subj = [...bySubject(recentSessions).entries()].sort((a, b) => b[1].minutes - a[1].minutes)
  if (subj.length) {
    push('', '### Son 30 gün ders dağılımı')
    for (const [id, v] of subj) {
      const name = SUBJECT_MAP[id] ? `${SUBJECT_MAP[id].exam} ${SUBJECT_MAP[id].name}` : 'Diğer'
      const acc = v.solved ? `, ${v.solved} soru (D ${v.correct} / Y ${v.wrong})` : ''
      push(`- ${name}: ${formatMinutes(v.minutes)}${acc}`)
    }
  }

  // Denemeler
  for (const type of ['TYT', 'AYT'] as const) {
    const list = sortedExams(data.exams, type).slice(-8)
    if (!list.length) continue
    const subjects = SUBJECTS.filter((x) => x.exam === type && list.some((e) => e.scores[x.id]))
    push('', `## Son ${type} denemeleri (eskiden yeniye)`)
    push(`| Tarih | Yayın | ${subjects.map((x) => x.short).join(' | ')} | Toplam net | D/Y/B |`)
    push(`|${'---|'.repeat(subjects.length + 4)}`)
    for (const e of list) {
      const t = totals(e)
      push(
        `| ${e.date} | ${e.name || '-'} | ${subjects.map((x) => (e.scores[x.id] ? fmtNet(net(e.scores[x.id])) : '-')).join(' | ')} | ${fmtNet(totalNet(e))} | ${t.correct}/${t.wrong}/${t.blank} |`
      )
    }
    const last = list[list.length - 1]
    if (type === 'TYT') {
      push(`- Son TYT tahmini ham puan ≈ ${fmtNet(estimateTyt(tytGroupNets(last)))}`)
    } else {
      const lastTyt = sortedExams(data.exams, 'TYT').at(-1)
      if (lastTyt) {
        const raw = estimateField(s.field, tytGroupNets(lastTyt), last)
        if (raw) push(`- Son ${FIELD_LABEL[s.field]} tahmini ham puan ≈ ${fmtNet(raw)} (yerleştirme ≈ ${fmtNet(placement(raw, s.obp))})`)
      }
    }
    const withMistakes = list.filter((e) => e.mistakes.length)
    if (withMistakes.length) {
      push('', `### ${type} denemelerinde yanlış/boş yapılan konular`)
      for (const e of withMistakes.slice(-5)) {
        const items = e.mistakes.map(
          (m) => `${TOPIC_MAP[m.topicId]?.name ?? m.topicId} ×${m.count} (${MISTAKE_KIND_LABEL[m.kind]})${m.note ? ` — ${m.note}` : ''}`
        )
        push(`- ${e.date} ${e.name}: ${items.join('; ')}`)
      }
    }
    const notes = list.filter((e) => e.note).slice(-3)
    for (const e of notes) push(`- Not (${e.date}): ${e.note}`)
  }
  if (!data.exams.length) push('', '## Denemeler', '- Henüz deneme girilmedi.')

  // Zayıf konular
  const weak = topicWeaknesses(data).slice(0, 20)
  if (weak.length) {
    push('', '## Uygulamanın hesapladığı öncelikli (zayıf) konular')
    weak.forEach((w, i) => {
      const kinds = Object.entries(w.kinds)
        .map(([k, v]) => `${MISTAKE_KIND_LABEL[k]} ${v}`)
        .join(', ')
      const practice = w.practiceSolved ? `, pratikte ${w.practiceSolved} soruda ${w.practiceWrong} yanlış` : ''
      push(
        `${i + 1}. ${w.subjectName} — ${w.topicName} (öncelik ${w.score}; deneme hatası ${w.examMistakes}, açık hata notu ${w.openNotes}${practice}${kinds ? `; türler: ${kinds}` : ''})`
      )
    })
  }

  // Konu ilerlemesi
  const relevant = [...subjectsFor('TYT'), ...subjectsFor('AYT', s.field === 'DIL' ? 'ALL' : s.field)]
  push('', '## Konu ilerlemesi (durum: 0 başlanmadı, 1 çalışılıyor, 2 konu bitti, 3 soru çözüldü, 4 pekişti)')
  for (const subject of relevant) {
    const p = subjectProgress(data, subject)
    const notStarted = subject.topics.filter((t) => (data.topicProgress[t.id]?.status ?? 0) === 0)
    const inProgress = subject.topics.filter((t) => data.topicProgress[t.id]?.status === 1)
    let line = `- ${subject.exam} ${subject.name}: ${p.done}/${p.total} konu bitti (ilerleme ${pct(p.pct)})`
    if (inProgress.length) line += `; çalışılıyor: ${inProgress.map((t) => t.name).join(', ')}`
    if (notStarted.length && notStarted.length < subject.topics.length) {
      line += `; başlanmamış: ${notStarted.map((t) => t.name).join(', ')}`
    } else if (notStarted.length === subject.topics.length) line += ' (hiç işaretlenmemiş)'
    push(line)
  }
  const lowConf = Object.entries(data.topicProgress)
    .filter(([, p]) => p.confidence && p.confidence <= 2)
    .map(([id]) => TOPIC_MAP[id]?.name)
    .filter(Boolean)
  if (lowConf.length) push(`- Kendine güvenmediği konular: ${lowConf.join(', ')}`)

  const due = reviewsDue(data)
  if (due.length) {
    push(
      `- Tekrar zamanı gelen konular: ${due
        .slice(0, 15)
        .map((d) => `${TOPIC_MAP[d.topicId]?.name} (${d.overdue} gün gecikti)`)
        .join(', ')}`
    )
  }

  // Hata defteri
  const open = data.mistakeNotes.filter((m) => !m.resolved)
  if (data.mistakeNotes.length) {
    push('', `## Hata defteri (${data.mistakeNotes.length} not, ${open.length} açık)`)
    for (const m of open.slice(0, 12)) {
      const topic = m.topicId ? ` / ${TOPIC_MAP[m.topicId]?.name}` : ''
      push(`- [${MISTAKE_KIND_LABEL[m.kind]}] ${SUBJECT_MAP[m.subjectId]?.name ?? ''}${topic}: ${m.text.slice(0, 200)}${m.lesson ? ` → Ders: ${m.lesson.slice(0, 150)}` : ''}`)
    }
  }

  // İkinci Beyin: konudan bağımsız beceri hafızası
  const memory = memoryForPrompt(data, { limit: 30 })
  if (memory) {
    push(
      '',
      '## İkinci Beyin — beceri hafızası (en zayıftan güçlüye)',
      'Not: Bir konudaki sorunun kökü başka konudaki bir beceri eksikliği olabilir. Plan ve önerilerde konu yerine bu kök becerileri hedeflemeyi düşün.',
      memory
    )
  }

  // Günlük planlar (bugün ve yarın)
  for (const key of [today, addDays(today, 1)]) {
    const plan = data.plans[key]
    if (!plan?.tasks.length) continue
    const done = plan.tasks.filter((t) => t.done).length
    push('', `## ${key === today ? 'Bugünün' : 'Yarının'} planı (${key}) — ${done}/${plan.tasks.length} görev bitti`)
    for (const t of plan.tasks) {
      const subj = t.subjectId ? SUBJECT_MAP[t.subjectId]?.short : ''
      const topic = t.topicId ? TOPIC_MAP[t.topicId]?.name : ''
      push(
        `- [${t.done ? 'x' : ' '}] ${t.time ?? ''} ${t.title}${subj ? ` (${subj}${topic ? ' / ' + topic : ''})` : ''}${t.scope ? ` — ${t.scope}` : ''}${t.targetMinutes ? `, ${t.targetMinutes} dk` : ''}${t.targetQuestions ? `, ${t.targetQuestions} soru` : ''}`
      )
    }
  }

  // Konu kataloğu: AI eylemlerinde kullanılacak kimlik ve adlar
  push('', '## Konu kataloğu (eylemlerde subjectId ve konu adı olarak bunları kullan)')
  push('(Köşeli parantez = konu grubu; mümkünse grubun içindeki en uygun konu adını kullan, emin değilsen grup adını yaz)')
  for (const subject of relevant) {
    const parts: string[] = []
    let lastGroup: string | undefined
    for (const t of subject.topics) {
      if (t.group && t.group !== lastGroup) parts.push(`[${t.group}] ${t.name}`)
      else parts.push(t.name)
      lastGroup = t.group
    }
    push(`- ${subject.id} (${subject.exam} ${subject.name}): ${parts.join('; ')}`)
  }

  // Hedefler
  if (data.goals.length) {
    push('', '## Hedefler')
    for (const g of data.goals) push(`- ${g.title} (hedef ${g.target}${g.deadline ? `, ${g.deadline}` : ''})${g.done ? ' ✓' : ''}`)
  }

  return lines.join('\n')
}

export const EXAM_PROMPT =
  'Ekteki deneme sonuç belgemi oku: ders ders doğru/yanlış/boş sayılarını ve varsa yanlış/boş yaptığım soruların konularını çıkar, kısa bir yorum yap ve denemeyi uygulamaya eklemek için yks-actions bloğu (exam eylemi) ver.'

export const PLAN_PROMPT =
  'Verilerime göre bugün için saatli bir çalışma planı oluştur ve uygulamaya eklenebilmesi için yks-actions bloğu olarak ver. Tekrar zamanı gelen konuları, zayıf konularımı ve günlük hedef süremi dikkate al; konu çalışma ile soru çözümünü dengele.'

export const QUICK_PROMPTS: { label: string; prompt: string; icon: string }[] = [
  { label: 'Bugünün planını oluştur', icon: '📋', prompt: PLAN_PROMPT },
  {
    label: 'Bugün ne çalışayım?',
    icon: '🎯',
    prompt:
      'Şu an ne çalışmalıyım? Verilerime göre tek bir sonraki adımı (ders, konu, ne kadar süre, kaç soru) ve nedenini kısaca söyle.'
  },
  {
    label: 'Son denemelerimi analiz et',
    icon: '📊',
    prompt:
      'Son TYT ve AYT denemelerimi detaylı analiz et: ders bazında net trendleri, güçlü/zayıf yanlarım, yanlış yaptığım konular ve hata türleri. Sonunda öncelik sırasına göre somut bir eylem listesi ver.'
  },
  {
    label: 'Haftalık program',
    icon: '🗓️',
    prompt:
      'Önümüzdeki 7 gün için gün gün bir çalışma programı hazırla ve her gün için ayrı bir plan eylemi olarak yks-actions bloğunda ver. Zayıf konularımı, başlanmamış konuları, tekrar zamanı gelenleri ve bir deneme gününü dahil et. Günlük hedef süreme uy.'
  },
  {
    label: 'En zayıf konularım',
    icon: '🧩',
    prompt:
      'En zayıf olduğum 10 konuyu sırala, her biri için neden zayıf olduğumu (bilgi eksiği mi, dikkat mi, süre mi) verilere dayanarak yorumla ve nasıl çalışmam gerektiğini (kaynak türü, soru sayısı, süre) öner.'
  },
  {
    label: 'Hedefime ulaşabilir miyim?',
    icon: '🚀',
    prompt:
      'Hedef netlerime ve kalan süreye göre mevcut gidişatımı değerlendir. Hangi derslerden kaç net artırmam gerekiyor ve bu gerçekçi mi? Aylık ara hedefler belirle.'
  },
  {
    label: 'Hata defterimi yorumla',
    icon: '📒',
    prompt:
      'Hata defterimdeki notlarda ve deneme hatalarımda tekrar eden örüntüler neler? Hangi hata türü baskın ve bunu azaltmak için ne yapmalıyım?'
  }
]

export const ANALYSIS_PROMPT = QUICK_PROMPTS[2].prompt

export const AI_MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', hint: 'En iyi analiz (önerilen)' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', hint: 'Hızlı ve dengeli' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5', hint: 'En hızlı ve ucuz' }
]


/**
 * Claude Code CLI (abonelik) modu için tek parça istem: talimatlar, veriler,
 * önceki konuşma ve yeni soru stdin'den tek mesaj olarak gönderilir.
 */
export function buildCliPrompt(
  messages: { role: 'user' | 'assistant'; content: string; attachments?: { name: string; rel: string; mime: string }[] }[],
  context: string | undefined,
  engine: 'claude' | 'codex' = 'claude'
): string {
  const history = messages.slice(0, -1)
  const last = messages[messages.length - 1]
  const parts = [`<talimatlar>\n${SYSTEM_PROMPT}\n</talimatlar>`]
  if (context) parts.push(`<ogrenci_verileri>\n${context}\n</ogrenci_verileri>`)
  if (history.length) {
    parts.push(
      `<onceki_konusma>\n${history.map((m) => `${m.role === 'user' ? 'Öğrenci' : 'Koç (sen)'}: ${m.content}`).join('\n\n')}\n</onceki_konusma>`
    )
  }
  const files = messages.flatMap((m) => m.attachments ?? [])
  if (files.length) {
    const how =
      engine === 'claude'
        ? 'Bu dosyalar çalışma klasöründe; Read aracıyla açıp dikkatlice incele:'
        : 'Görseller bu mesaja eklendi; diğer dosyalar çalışma klasöründe:'
    parts.push(`<ekli_dosyalar>\n${how}\n${files.map((f) => `- ${f.rel} (${f.name})`).join('\n')}\n</ekli_dosyalar>`)
  }
  parts.push(`Öğrencinin yeni mesajı:\n${last?.content ?? ''}`)
  return parts.join('\n\n')
}
