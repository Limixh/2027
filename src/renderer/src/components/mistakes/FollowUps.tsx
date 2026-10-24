// AI analizine soru sorma: "şurayı tekrar anlat", "bu adım neden böyle?".
// Analizde bir yeri seçersen soru o kısım hakkında sorulur.
import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Loader2, MessageCircleQuestion, Quote, Send, X } from 'lucide-react'
import type { ChatAttachment, MistakeNote } from '../../../../shared/types'
import { Button, Textarea, cn } from '@/components/ui'
import { AiError, TUTOR_SYSTEM, askAiWithModel, followUpPrompt } from '@/lib/aiRunner'
import { uid } from '@/lib/id'
import { useStore } from '@/lib/store'

const QUICK = ['Bu kısmı daha basit anlat', 'Bu adım neden böyle?', 'Başka bir yoldan çözer misin?', 'Sayılarla örnek verir misin?']

const Md = ({ children }: { children: string }): React.JSX.Element => (
  <div className="prose-ai">
    <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
  </div>
)

export function FollowUps({
  note,
  subject,
  topic,
  images,
  analysisRef
}: {
  note: MistakeNote
  subject: string
  topic?: string
  images: ChatAttachment[]
  /** Seçim yapılabilen analiz metninin kapsayıcısı */
  analysisRef: React.RefObject<HTMLDivElement | null>
}): React.JSX.Element {
  const update = useStore((s) => s.updateMistakeNote)
  const [question, setQuestion] = useState('')
  const [quote, setQuote] = useState('')
  const [busy, setBusy] = useState(false)
  const [live, setLive] = useState('')
  const [pending, setPending] = useState<{ question: string; quote?: string } | null>(null)
  const [error, setError] = useState('')
  const input = useRef<HTMLTextAreaElement>(null)
  const items = note.followUps ?? []

  // Analizde metin seçilince alıntı olarak al
  useEffect(() => {
    const onUp = (): void => {
      const sel = window.getSelection()
      const box = analysisRef.current
      if (!sel || sel.isCollapsed || !box || !box.contains(sel.anchorNode)) return
      const text = sel.toString().replace(/\s+/g, ' ').trim()
      if (text.length >= 3) setQuote(text.slice(0, 600))
    }
    document.addEventListener('mouseup', onUp)
    return () => document.removeEventListener('mouseup', onUp)
  }, [analysisRef])

  const ask = async (q: string): Promise<void> => {
    const text = q.trim()
    if (!text || busy || !note.aiAnalysis) return
    const asked = { question: text, quote: quote || undefined }
    setBusy(true)
    setError('')
    setLive('')
    setPending(asked)
    setQuestion('')
    setQuote('')
    try {
      const r = await askAiWithModel({
        system: TUTOR_SYSTEM,
        prompt: followUpPrompt({ subject, topic, analysis: note.aiAnalysis, history: items, ...asked, hasImages: images.length > 0 }),
        attachments: images.length ? images : undefined,
        onText: setLive
      })
      const cur = useStore.getState().data.mistakeNotes.find((m) => m.id === note.id)
      update(note.id, {
        followUps: [...(cur?.followUps ?? []), { id: uid(), ...asked, answer: r.text.trim(), model: r.model, createdAt: new Date().toISOString() }]
      })
    } catch (e) {
      setError(e instanceof AiError || e instanceof Error ? e.message : 'Cevap alınamadı')
      // Soruyu kaybetme: kutuya geri koy
      setQuestion(text)
      setQuote(asked.quote ?? '')
    } finally {
      setPending(null)
      setLive('')
      setBusy(false)
    }
  }

  const remove = (id: string): void => update(note.id, { followUps: items.filter((x) => x.id !== id) })

  return (
    <div className="mt-5 border-t border-dashed border-border pt-4">
      <div className="mb-3 flex items-center gap-1.5 text-xs font-medium text-muted">
        <MessageCircleQuestion size={14} className="text-accent" />
        Anlamadığın bir yer mi var? Sor.
      </div>

      {items.length > 0 && (
        <ul className="mb-4 space-y-4">
          {items.map((f) => (
            <li key={f.id} className="group space-y-2">
              <Question text={f.question} quote={f.quote} onRemove={() => remove(f.id)} />
              <div className="pl-3">
                <Md>{f.answer}</Md>
                {f.model && <div className="mt-1 text-[11px] text-subtle">{f.model}</div>}
              </div>
            </li>
          ))}
        </ul>
      )}

      {pending && (
        <div className="mb-4 space-y-2">
          <Question text={pending.question} quote={pending.quote} />
          <div className="pl-3">
            {live ? (
              <Md>{live}</Md>
            ) : (
              <p className="flex items-center gap-2 text-xs text-subtle">
                <Loader2 size={12} className="animate-spin" /> Düşünüyor…
              </p>
            )}
          </div>
        </div>
      )}

      {error && <p className="mb-2 text-xs text-danger">{error}</p>}

      {quote ? (
        <div className="mb-2 flex items-start gap-2 rounded-lg bg-accent/10 px-3 py-2 text-xs text-text">
          <Quote size={12} className="mt-0.5 shrink-0 text-accent" />
          <span className="line-clamp-3 flex-1">{quote}</span>
          <button type="button" onClick={() => setQuote('')} aria-label="Alıntıyı kaldır" className="shrink-0 text-subtle hover:text-text">
            <X size={12} />
          </button>
        </div>
      ) : (
        <p className="mb-2 text-[11px] text-subtle">İpucu: analizde anlamadığın cümleyi fareyle seç, soru o kısım hakkında sorulur.</p>
      )}

      <div className="mb-2 flex flex-wrap gap-1.5">
        {QUICK.map((q) => (
          <button
            key={q}
            type="button"
            disabled={busy}
            onClick={() => void ask(q)}
            className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted transition-colors hover:border-accent/50 hover:text-text disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>
      <div className="flex items-end gap-2">
        <Textarea
          ref={input}
          rows={2}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void ask(question)
            }
          }}
          placeholder={quote ? 'Bu kısımla ilgili ne sormak istiyorsun?' : 'ör. 3. adımda neden iki tarafı x ile çarptık?'}
          className="min-h-[60px]"
          disabled={busy}
        />
        <Button variant="primary" size="sm" disabled={busy || !question.trim()} icon={<Send size={13} />} onClick={() => void ask(question)}>
          Sor
        </Button>
      </div>
    </div>
  )
}

function Question({ text, quote, onRemove }: { text: string; quote?: string; onRemove?: () => void }): React.JSX.Element {
  return (
    <div className="flex items-start gap-2">
      <div className={cn('min-w-0 flex-1 rounded-lg bg-surface-2 px-3 py-2 text-sm')}>
        {quote && <div className="mb-1 line-clamp-2 border-l-2 border-accent/60 pl-2 text-xs text-muted">{quote}</div>}
        <div className="whitespace-pre-wrap">{text}</div>
      </div>
      {onRemove && (
        <button type="button" onClick={onRemove} className="mt-2 shrink-0 text-xs text-subtle opacity-0 transition hover:text-danger group-hover:opacity-100">
          sil
        </button>
      )}
    </div>
  )
}
