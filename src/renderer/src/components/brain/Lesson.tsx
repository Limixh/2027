import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Eye, EyeOff, RefreshCw, Sparkles } from 'lucide-react'
import { SUBJECT_MAP } from '@/data/curriculum'
import { Button } from '@/components/ui'
import { AiError, askAiWithModel, TUTOR_SYSTEM } from '@/lib/aiRunner'
import { STATUS_LABEL } from '@/lib/brain'
import { useStore } from '@/lib/store'
import { KIND_META, groupTopics, topicShort, type SkillRow } from './shared'

const SEP = '---CEVAPLAR---'

function lessonPrompt(s: SkillRow, noteTexts: Record<string, string>): string {
  const groups = groupTopics(s)
  const where = groups.length
    ? groups.map((g) => `- ${SUBJECT_MAP[g.subjectId]?.name ?? g.subjectId}: ${g.topics.map((t) => t.name).join(', ')}`).join('\n')
    : '- (henüz konu bilgisi yok)'
  const ev = s.evidence
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 12)
    .map((e) => {
      const n = e.noteId ? noteTexts[e.noteId] : ''
      return `- ${e.date} · ${KIND_META[e.kind].label}${e.topicId ? ` · ${topicShort(e.topicId)}` : ''}${e.detail ? `: ${e.detail}` : ''}${n ? ` [soru notu: ${n.slice(0, 100)}]` : ''}`
    })
    .join('\n')
  const cross = s.topicIds.length > 1
  return `Öğrencim aşağıdaki BECERİDE zorlanıyor. Bu beceri tek bir konuya ait değil; farklı konulardaki sorularda kök neden olarak ortaya çıkıyor. Ona kısa ama çok net bir mini ders ve pratik hazırla.

Beceri: "${s.name}"
${s.description ? `Tanım: ${s.description}\n` : ''}Mevcut durum: ${STATUS_LABEL[s.strength.status]} (${s.strength.score}/100), ${s.strength.misses} eksik/zorlanma, ${s.strength.wins} başarı.

Bu becerinin göründüğü konular:
${where}

Kanıtlar (en yeniden eskiye; öğrencinin tam olarak nerede takıldığını gösterir):
${ev || '- (kanıt yok)'}

Şunları yaz (Markdown, başlıklar ## ile):
## Bu beceri nedir
2-3 cümle; sezgisel ve sade. Kanıtlardaki takılma noktalarına değin.
## Ne zaman gerekir
Hangi soru tiplerinde bu becerinin devreye girdiğini, işaretlerini söyle.${cross ? ' Özellikle farklı konularda (yukarıdaki listeden) nasıl göründüğünü anlat; aynı beceri başka bir kılıkta nasıl karşına çıkıyor?' : ''}
## Sık yapılan tuzaklar
3-4 madde; kanıtlardaki gerçek hatalara göre özelleştir.
## Çözümlü örnek 1 ve Çözümlü örnek 2
İki ayrı örnek, tam çözümüyle adım adım.${cross ? ' İkisi FARKLI konulardan olsun (yukarıdaki konulardan seç) ve başlıkta konuyu belirt; böylece öğrenci aynı becerinin iki yerde işe yaradığını görsün.' : ' İkisi birbirinden farklı soru tipinde olsun.'}
## Pratik soruları
3 soru, kolaydan zora. ${cross ? 'Mümkünse farklı konulardan olsun. ' : ''}Çözümlerini bu bölümde VERME.

Pratik sorularından hemen sonra tek başına bir satırda tam olarak ${SEP} yaz; bunun altına 3 sorunun cevaplarını kısa çözüm adımlarıyla ver.`
}

export function Lesson({ skill }: { skill: SkillRow }): React.JSX.Element {
  const update = useStore((s) => s.updateSkill)
  const notes = useStore((s) => s.data.mistakeNotes)
  const [busy, setBusy] = useState(false)
  const [live, setLive] = useState('')
  const [error, setError] = useState('')
  const [show, setShow] = useState(false)

  const run = async (): Promise<void> => {
    if (busy) return
    setBusy(true)
    setError('')
    setLive('')
    setShow(false)
    try {
      const noteTexts: Record<string, string> = {}
      for (const e of skill.evidence) {
        const n = e.noteId ? notes.find((m) => m.id === e.noteId) : undefined
        if (n?.text) noteTexts[n.id] = n.text
      }
      const { text: full, model } = await askAiWithModel({ system: TUTOR_SYSTEM, prompt: lessonPrompt(skill, noteTexts), onText: setLive })
      update(skill.id, { lesson: full.trim(), lessonModel: model })
      setLive('')
    } catch (e) {
      setError(e instanceof AiError ? e.message : 'Ders oluşturulamadı')
    } finally {
      setBusy(false)
    }
  }

  const source = busy ? live : (skill.lesson ?? '')
  const idx = source.indexOf(SEP)
  const body = idx >= 0 ? source.slice(0, idx).trim() : source
  const answers = idx >= 0 ? source.slice(idx + SEP.length).trim() : ''

  return (
    <div>
      {!source && !busy && (
        <p className="mb-3 max-w-lg text-[13px] leading-relaxed text-muted">
          Bu beceriye özel, kanıtlarındaki gerçek takılma noktalarına göre kısa bir ders, iki çözümlü örnek ve üç pratik sorusu hazırlanır.
        </p>
      )}
      <div className="flex items-center gap-2">
        <Button variant={source ? 'ghost' : 'outline'} size="sm" onClick={() => void run()} disabled={busy} icon={source ? <RefreshCw size={13} /> : <Sparkles size={13} />}>
          {busy ? 'Hazırlanıyor…' : source ? 'Yeniden oluştur' : 'Mini ders + pratik'}
        </Button>
      </div>
      {error && <p className="mt-3 text-xs text-danger">{error}</p>}
      {source && (
        <div className="mt-4">
          <div className="prose-ai">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
            {busy && <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-accent align-middle" />}
          </div>
          {!busy && skill.lessonModel && <div className="mt-2 text-[11px] text-subtle">{skill.lessonModel}</div>}
          {answers && (
            <div className="mt-4 border-t border-border pt-3">
              <Button variant="ghost" size="sm" onClick={() => setShow((v) => !v)} icon={show ? <EyeOff size={13} /> : <Eye size={13} />}>
                {show ? 'Cevapları gizle' : 'Cevapları göster'}
              </Button>
              {show && (
                <div className="prose-ai mt-2">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{answers}</ReactMarkdown>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

