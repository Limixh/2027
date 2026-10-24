// Sohbet ekranı dışında tek seferlik AI istekleri (soru analizi, benzer soru üretimi vb.).
// Ayarlardaki bağlantı türünü kullanır: Claude aboneliği (CLI), ChatGPT (Codex) veya Claude API.
import type { ChatAttachment } from '../../../shared/types'
import { buildCliPrompt } from './aiContext'
import { repairJson } from './aiActions'
import { uid } from './id'
import { useStore } from './store'

export interface AskOptions {
  /** Görev talimatı (sistem istemi gibi) */
  system: string
  /** Kullanıcı mesajı */
  prompt: string
  attachments?: ChatAttachment[]
  /** Akış sırasında gelen metin (birikmiş tam metin) */
  onText?: (full: string) => void
}

export class AiError extends Error {}

/** AI'ye tek bir soru sorar; tam cevabı döndürür */
export function askAi(opts: AskOptions): Promise<string> {
  const api = window.api
  if (!api) return Promise.reject(new AiError('AI yalnızca masaüstü uygulamasında çalışır'))
  const st = useStore.getState().data.settings
  const requestId = uid()
  return new Promise((resolve, reject) => {
    let text = ''
    const off = api.ai.onEvent((ev) => {
      if (ev.requestId !== requestId) return
      if (ev.type === 'text') {
        text += ev.text
        opts.onText?.(text)
        return
      }
      off()
      if (ev.type === 'error') reject(new AiError(ev.message))
      else {
        if (st.aiProvider === 'codex' && ev.model && ev.model !== 'codex' && ev.model !== st.codexModel) {
          useStore.getState().updateSettings({ codexModel: ev.model })
        }
        resolve(ev.fullText || text)
      }
    })
    const messages = [{ role: 'user' as const, content: opts.prompt, attachments: opts.attachments }]
    // CLI modlarında talimat ayrı sistem istemi olarak gidemediği için mesajın başına eklenir
    const cliPrompt = (engine: 'claude' | 'codex'): string =>
      `<gorev_talimati>\n${opts.system}\n</gorev_talimati>\n\n` + buildCliPrompt(messages, undefined, engine).replace(/^<talimatlar>[\s\S]*?<\/talimatlar>\n\n/, '')
    if (st.aiProvider === 'cli') {
      void api.ai.cliChat({ requestId, model: st.aiModel, prompt: cliPrompt('claude'), attachments: opts.attachments })
    } else if (st.aiProvider === 'codex') {
      void api.ai.codexChat({ requestId, model: st.codexModel ?? '', prompt: cliPrompt('codex'), attachments: opts.attachments })
    } else {
      void api.ai.chat({ requestId, model: st.aiModel, effort: st.aiEffort, system: opts.system, messages })
    }
  })
}

/* ---------- Soru analizi ve benzer soru istemleri ---------- */

export const TUTOR_SYSTEM = `Sen YKS'ye (2027, mevcut 2018 tabanlı müfredat) hazırlanan bir öğrencinin birebir özel ders öğretmenisin. Her zaman Türkçe, sade ve cesaret verici ama net yaz. Matematik ifadelerini düz metinle yaz (ör. x^2, √3, 3/4); LaTeX kullanma.`

export function analysisPrompt(p: {
  subject: string
  topic?: string
  hasAttempt: boolean
  note?: string
  correctAnswer?: string
  myAnswer?: string
  usedSolution?: boolean
  comments?: { date: string; text: string }[]
  /** İkinci Beyin hafızası (memoryForPrompt çıktısı) */
  memory?: string
}): string {
  const facts = [
    p.comments?.length
      ? `Öğrencinin bu soru hakkındaki kendi yorumları (nerede takıldığını anlatıyor; analizini özellikle bunlara göre yap ve her birine cevap ver):\n${p.comments.map((c) => `- (${c.date}) ${c.text}`).join('\n')}`
      : '',
    p.correctAnswer ? `Doğru cevap (cevap anahtarından): ${p.correctAnswer} — çözümün bu cevaba ulaşmalı; ulaşamıyorsan bunu açıkça söyle.` : '',
    p.myAnswer ? `Öğrencinin işaretlediği cevap: ${p.myAnswer}.` : '',
    p.usedSolution
      ? 'Öğrenci bu soruyu kendisi çözemeyip ÇÖZÜME BAKARAK yaptı: hangi adımı kendi başına bulamamış olabileceğini ve bu adımı nasıl kendisi bulabileceğini (hangi ipucu/kalıp) özellikle açıkla.'
      : ''
  ].filter(Boolean)
  return `Ekteki görsel(ler) öğrencinin yanlış yaptığı / çözemediği bir ${p.subject}${p.topic ? ` (${p.topic})` : ''} sorusu.${
    p.hasAttempt ? ' Görsellerden biri öğrencinin silinmemiş, karalamalı kendi çözüm denemesi.' : ''
  }${p.note ? `\nÖğrencinin notu: ${p.note}` : ''}${facts.length ? `\n${facts.join('\n')}` : ''}

Şunları başlıklarla yaz:
## Soru ne istiyor?
Kısa ve net.
## Doğru çözüm
Adım adım, gereksiz uzatmadan. En sonda doğru cevabı belirt.
${
  p.hasAttempt
    ? `## Senin çözümün — nerede takıldın?
Öğrencinin işlemlerini satır satır incele: hangi adıma kadar doğru gitti, tam olarak hangi adımda ve NEDEN hata yaptı (işlem hatası, kavram yanılgısı, soru kökünü yanlış okuma, eksik bilgi, süre baskısı...). "Burada şunu yazmışsın, aslında şöyle olmalıydı" diye somut göster.
`
    : ''
}## Bu soruyu bir daha kaçırmamak için
2-4 madde: hangi kural/kavram, hangi tuzak, hangi kontrol alışkanlığı.
${
  p.memory
    ? `## Hafızadan: daha önce de olmuş mu?
Aşağıdaki "öğrencinin beceri hafızası"na bak. Bu sorudaki takılma, daha önce BAŞKA bir konuda da görülmüş bir beceri eksikliğiyle aynı köke sahipse bunu açıkça bağla (ör. "Bu parabol sorusunda kesişim noktasını bulurken takıldığın adım, 2 bilinmeyenli denklemlerde zorlandığın yok etme yöntemiyle aynı"). Bağlantı yoksa bu başlığı tek cümleyle geç.

<ogrencinin_beceri_hafizasi>
${p.memory}
</ogrencinin_beceri_hafizasi>
`
    : ''
}
En sonda tek bir kod bloğu ekle (dili yks-note), içinde yalnızca JSON:
{"topic":"konunun müfredattaki adı","kind":"bilgi|dikkat|sure|yorum|bos|cozum","summary":"hatanın tek cümlelik özeti","lesson":"akılda tutulacak tek cümle","skills":[{"id":"hafızadaki id (aynı beceriyse) ya da boş","name":"beceri adı","role":"eksik|zayif|basari","detail":"bu soruda bu becerinin rolü, 1 cümle","description":"yeni beceriyse kısa genel tanım"}]}

skills kuralları: Soruyu çözmek için gereken 1-4 temel beceri/yöntem/kavramı yaz. Beceri adı KONUDAN BAĞIMSIZ ve yeniden kullanılabilir olsun (ör. "Denklem sisteminde yok etme yöntemi", "Kesirli ifadelerde payda eşitleme", "Geri koymadan olasılıkta koşullu olasılık", "Paragrafta ana düşünceyi yardımcıdan ayırma"); "parabol sorusu" gibi konu adları beceri değildir. Hafızada aynı ya da çok yakın bir beceri varsa YENİ AD UYDURMA, onun id'sini ve adını aynen kullan. role: öğrencinin yapamadığı adım = eksik, zorlandığı/çözüme baktığı = zayif, doğru kullandığı = basari.`
}

export function similarPrompt(p: { subject: string; topic?: string; count: number; analysis?: string }): string {
  return `Ekteki görseldeki ${p.subject}${p.topic ? ` (${p.topic})` : ''} sorusuna BENZER, aynı kazanımı ölçen ve aynı tuzağı içeren ${p.count} yeni soru yaz. YKS (ÖSYM) tarzında, 5 seçenekli (A-E) olsun; zorluk orijinale yakın, biri biraz daha zor olabilir.${
    p.analysis ? `\nÖğrencinin bu soruda yaptığı hatanın analizi (bu zayıflığı hedefle):\n${p.analysis.slice(0, 1500)}` : ''
  }

Biçim (kesinlikle uy):
### Soru 1
(soru metni)
A) ... B) ... C) ... D) ... E) ...
(diğer sorular aynı biçimde)

---CEVAPLAR---
1. Doğru seçenek — kısa çözüm (2-3 satır)
(her soru için)`
}

/** Analiz metninin sonundaki yks-note bloğunu ayırır */
export function splitNoteMeta(text: string): {
  body: string
  meta: {
    topic?: string
    kind?: string
    summary?: string
    lesson?: string
    skills?: { id?: string; name: string; role?: string; detail?: string; description?: string }[]
  } | null
} {
  const m = text.match(/```yks-note\s*([\s\S]*?)```/)
  if (!m) return { body: text.trim(), meta: null }
  let meta = null
  try {
    meta = JSON.parse(repairJson(m[1].trim()))
  } catch {
    meta = null
  }
  return { body: text.replace(m[0], '').trim(), meta }
}
