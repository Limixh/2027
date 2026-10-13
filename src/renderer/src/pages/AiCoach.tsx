import {
  ArrowUp,
  Bot,
  Check,
  ClipboardCopy,
  Database,
  Eye,
  KeyRound,
  MessageSquarePlus,
  Sparkles,
  Square,
  Trash2,
  TriangleAlert,
  User
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ChatMessage, ChatThread } from '../../../shared/types'
import { Button, Card, cn, confirm, Input, Modal, toast } from '@/components/ui'
import { AI_MODELS, ANALYSIS_PROMPT, buildContext, QUICK_PROMPTS, SYSTEM_PROMPT } from '@/lib/aiContext'
import { relativeDay, todayKey } from '@/lib/date'
import { uid } from '@/lib/id'
import { useNav } from '@/lib/nav'
import { useStore } from '@/lib/store'

const modelLabel = (id: string): string => AI_MODELS.find((m) => m.id === id)?.label ?? id

/** API ardışık aynı rollü mesaj kabul etmez — birleştir */
function toApiMessages(msgs: ChatMessage[]): { role: 'user' | 'assistant'; content: string }[] {
  const out: { role: 'user' | 'assistant'; content: string }[] = []
  for (const m of msgs) {
    if (m.error || !m.content.trim()) continue
    const last = out[out.length - 1]
    if (last && last.role === m.role) last.content += '\n\n' + m.content
    else out.push({ role: m.role, content: m.content })
  }
  while (out.length && out[0].role !== 'user') out.shift()
  return out
}

function KeySetup({ onSaved }: { onSaved: () => void }): React.JSX.Element {
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const model = useStore((s) => s.data.settings.aiModel)
  const save = async (): Promise<void> => {
    if (!window.api) return
    setBusy(true)
    await window.api.ai.setKey(key)
    const res = await window.api.ai.testKey(model)
    setBusy(false)
    if (res.ok) {
      toast('API anahtarı kaydedildi')
      onSaved()
    } else {
      toast(res.message, 'error')
      await window.api.ai.clearKey()
    }
  }
  return (
    <Card className="mx-auto max-w-xl p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-accent to-accent-2 text-white">
          <KeyRound size={20} />
        </div>
        <div>
          <h3 className="font-semibold">API anahtarı bağla (ayrı ücretli)</h3>
          <p className="text-xs text-muted">Claude aboneliğinden ayrıdır; console.anthropic.com'dan kredi yüklenir. Cevaplar burada, sohbet geçmişiyle gelir.</p>
        </div>
      </div>
      <ol className="mb-4 list-decimal space-y-1.5 pl-5 text-sm text-muted">
        <li>
          <button className="text-accent hover:underline" onClick={() => window.api?.openExternal('https://console.anthropic.com/settings/keys')}>
            console.anthropic.com
          </button>{' '}
          adresinden bir API anahtarı oluştur (sk-ant-… ile başlar).
        </li>
        <li>Anahtarı aşağıya yapıştır. Anahtar bilgisayarında Windows şifrelemesiyle saklanır, başka bir yere gönderilmez.</li>
      </ol>
      <div className="flex gap-2">
        <Input
          type="password"
          placeholder="sk-ant-api03-…"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && key && void save()}
        />
        <Button variant="primary" disabled={!key || busy} onClick={() => void save()}>
          {busy ? 'Test ediliyor…' : 'Kaydet'}
        </Button>
      </div>
    </Card>
  )
}

function MessageBubble({ m, streaming }: { m: ChatMessage; streaming?: boolean }): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  if (m.role === 'user') {
    return (
      <div className="flex justify-end gap-3">
        <div className="max-w-[75%] whitespace-pre-wrap rounded-2xl rounded-tr-md bg-accent px-4 py-2.5 text-sm text-white shadow-sm">
          {m.content}
        </div>
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-3 text-muted">
          <User size={15} />
        </div>
      </div>
    )
  }
  return (
    <div className="group flex gap-3">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent to-accent-2 text-white">
        <Sparkles size={15} />
      </div>
      <div className="min-w-0 max-w-[85%] flex-1">
        <div
          className={cn(
            'rounded-2xl rounded-tl-md border px-4 py-3',
            m.error ? 'border-danger/40 bg-danger/5 text-danger' : 'border-border bg-surface'
          )}
        >
          {m.error ? (
            <div className="flex items-start gap-2 text-sm">
              <TriangleAlert size={16} className="mt-0.5 shrink-0" />
              {m.content}
            </div>
          ) : m.content ? (
            <div className="prose-ai">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
              {streaming && <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-accent align-middle" />}
            </div>
          ) : (
            <div className="flex items-center gap-2 py-1 text-sm text-muted">
              <span className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent" style={{ animationDelay: `${i * 120}ms` }} />
                ))}
              </span>
              Verilerin inceleniyor, düşünüyor…
            </div>
          )}
        </div>
        {!streaming && !m.error && m.content && (
          <button
            className="mt-1 flex items-center gap-1 text-[11px] text-subtle opacity-0 transition group-hover:opacity-100 hover:text-text"
            onClick={() => {
              void navigator.clipboard.writeText(m.content)
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            }}
          >
            {copied ? <Check size={12} /> : <ClipboardCopy size={12} />} {copied ? 'Kopyalandı' : 'Kopyala'}
          </button>
        )}
      </div>
    </div>
  )
}

export default function AiCoach(): React.JSX.Element {
  const data = useStore((s) => s.data)
  const chats = data.chats
  const settings = data.settings
  const upsertChat = useStore((s) => s.upsertChat)
  const deleteChat = useStore((s) => s.deleteChat)
  const updateSettings = useStore((s) => s.updateSettings)
  const params = useNav((s) => s.params)

  const isDesktop = !!window.api
  const [hasKey, setHasKey] = useState<boolean | null>(isDesktop ? null : false)
  const [activeId, setActiveId] = useState<string | null>(chats[0]?.id ?? null)
  const [input, setInput] = useState('')
  const [includeContext, setIncludeContext] = useState(true)
  const [showContext, setShowContext] = useState(false)
  const [streaming, setStreaming] = useState<{ requestId: string; threadId: string; text: string } | null>(null)
  const streamRef = useRef(streaming)
  streamRef.current = streaming
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const active = chats.find((c) => c.id === activeId) ?? null
  const context = useMemo(() => (showContext ? buildContext(data) : ''), [showContext, data])

  useEffect(() => {
    if (isDesktop) void window.api!.ai.hasKey().then(setHasKey)
  }, [isDesktop])

  // Akış olaylarını dinle
  useEffect(() => {
    if (!window.api) return
    return window.api.ai.onEvent((ev) => {
      const cur = streamRef.current
      if (!cur || ev.requestId !== cur.requestId) return
      if (ev.type === 'text') {
        setStreaming({ ...cur, text: cur.text + ev.text })
        return
      }
      const thread = useStore.getState().data.chats.find((c) => c.id === cur.threadId)
      if (thread) {
        const msg: ChatMessage =
          ev.type === 'error'
            ? { id: uid(), role: 'assistant', content: ev.message, error: true, createdAt: new Date().toISOString() }
            : { id: uid(), role: 'assistant', content: cur.text || '(boş yanıt)', createdAt: new Date().toISOString() }
        if (ev.type === 'done' && ev.stopReason === 'max_tokens') msg.content += '\n\n_(Yanıt uzunluk sınırına ulaştı.)_'
        if (ev.type === 'done' && ev.stopReason === 'aborted' && !cur.text) msg.content = '_(Durduruldu)_'
        // Hata ve tamamlanma durumunda da o ana kadar gelen metni koru
        const extra: ChatMessage[] =
          ev.type === 'error' && cur.text
            ? [{ id: uid(), role: 'assistant', content: cur.text, createdAt: new Date().toISOString() }]
            : []
        upsertChat({ ...thread, messages: [...thread.messages, ...extra, msg], updatedAt: new Date().toISOString() })
      }
      setStreaming(null)
    })
  }, [upsertChat])

  // Otomatik kaydırma
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [active?.messages.length, streaming?.text, activeId])

  const send = useCallback(
    (text: string) => {
      const content = text.trim()
      if (!content || streamRef.current || !window.api) return
      const nowIso = new Date().toISOString()
      const userMsg: ChatMessage = { id: uid(), role: 'user', content, createdAt: nowIso }
      const current = useStore.getState().data.chats.find((c) => c.id === activeId)
      const thread: ChatThread = current
        ? { ...current, messages: [...current.messages, userMsg], updatedAt: nowIso }
        : {
            id: uid(),
            title: content.length > 48 ? content.slice(0, 46) + '…' : content,
            messages: [userMsg],
            createdAt: nowIso,
            updatedAt: nowIso
          }
      upsertChat(thread)
      setActiveId(thread.id)
      setInput('')
      const requestId = uid()
      setStreaming({ requestId, threadId: thread.id, text: '' })
      const st = useStore.getState().data
      void window.api.ai.chat({
        requestId,
        model: st.settings.aiModel,
        effort: st.settings.aiEffort,
        system: SYSTEM_PROMPT,
        context: includeContext ? buildContext(st) : undefined,
        messages: toApiMessages(thread.messages)
      })
    },
    [activeId, includeContext, upsertChat]
  )

  // Analiz sayfasından "AI ile analiz" ile gelindiyse otomatik başlat
  const autoRef = useRef(false)
  useEffect(() => {
    if (autoRef.current || params.prompt !== 'analiz' || !hasKey) return
    autoRef.current = true
    setActiveId(null)
    // activeId güncellendikten sonra gönder
    setTimeout(() => setInput(ANALYSIS_PROMPT), 0)
  }, [params.prompt, hasKey])

  const copyPrompt = (question?: string): void => {
    const q = question ?? (input.trim() || ANALYSIS_PROMPT)
    const text = `${SYSTEM_PROMPT}\n\n---\n\n${buildContext(data)}\n\n---\n\nSorum: ${q}`
    void navigator.clipboard.writeText(text)
    toast("Prompt panoya kopyalandı — claude.ai'ye yapıştırabilirsin", 'info')
  }

  /** Claude aboneliği olanlar için: prompt'u kopyala ve claude.ai'de yeni sohbet aç */
  const openInClaude = (question: string): void => {
    copyPrompt(question)
    const url = 'https://claude.ai/new'
    if (window.api) void window.api.openExternal(url)
    else window.open(url, '_blank')
    toast("Kopyalandı! Açılan claude.ai sayfasında mesaj kutusuna tıklayıp Ctrl+V yap, sonra Enter'a bas.", 'info')
  }

  const newChat = (): void => {
    if (streaming) return
    setActiveId(null)
    setInput('')
    inputRef.current?.focus()
  }

  const messages = active?.messages ?? []
  const showStreaming = streaming && streaming.threadId === active?.id

  return (
    <div className="flex h-[calc(100vh-40px-2.5rem)] min-h-[560px] gap-5 pt-1">
      {/* Sohbet geçmişi */}
      <Card className="hidden w-60 shrink-0 flex-col overflow-hidden xl:flex">
        <div className="p-3">
          <Button variant="primary" className="w-full justify-center" icon={<MessageSquarePlus size={16} />} onClick={newChat}>
            Yeni sohbet
          </Button>
        </div>
        <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
          {chats.length === 0 && <p className="px-3 py-6 text-center text-xs text-subtle">Henüz sohbet yok</p>}
          {chats
            .slice()
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .map((c) => (
              <div
                key={c.id}
                className={cn(
                  'group flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm transition',
                  c.id === activeId ? 'bg-surface-2 text-text' : 'text-muted hover:bg-surface-2/60 hover:text-text'
                )}
                onClick={() => !streaming && setActiveId(c.id)}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate">{c.title}</div>
                  <div className="text-[10px] text-subtle">{relativeDay(c.updatedAt.slice(0, 10) || todayKey())}</div>
                </div>
                <button
                  className="opacity-0 transition hover:text-danger group-hover:opacity-100"
                  aria-label="Sohbeti sil"
                  onClick={async (e) => {
                    e.stopPropagation()
                    if (await confirm({ title: 'Sohbet silinsin mi?' })) {
                      deleteChat(c.id)
                      if (c.id === activeId) setActiveId(null)
                    }
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
        </div>
      </Card>

      {/* Sohbet alanı */}
      <Card className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-accent to-accent-2 text-white">
              <Bot size={17} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold">AI Koç</div>
              <div className="truncate text-[11px] text-muted">{modelLabel(settings.aiModel)} · verilerinle kişisel analiz</div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button size="icon" variant="ghost" className="xl:hidden" onClick={newChat} title="Yeni sohbet" aria-label="Yeni sohbet">
              <MessageSquarePlus size={15} />
            </Button>
            <select
              className="input h-8 w-auto py-0 text-xs"
              value={settings.aiModel}
              onChange={(e) => updateSettings({ aiModel: e.target.value })}
              title="Model"
            >
              {AI_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            <button
              className={cn(
                'flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition',
                includeContext ? 'border-accent/40 bg-accent/10 text-accent' : 'border-border text-muted'
              )}
              onClick={() => setIncludeContext((v) => !v)}
              title="Verilerini AI'ye bağlam olarak gönder"
            >
              <Database size={13} /> <span className="hidden 2xl:inline">Verilerim</span> {includeContext ? 'açık' : 'kapalı'}
            </button>
            <Button size="sm" variant="ghost" icon={<Eye size={14} />} onClick={() => setShowContext(true)} title="Gönderilen verileri gör">
              <span className="hidden 2xl:inline">Bağlam</span>
            </Button>
            <Button size="sm" variant="ghost" icon={<ClipboardCopy size={14} />} onClick={() => copyPrompt()} title="Prompt'u kopyala (claude.ai'de kullanmak için)">
              <span className="hidden 2xl:inline">Prompt'u kopyala</span>
            </Button>
          </div>
        </div>

        {hasKey === false ? (
          <div className="flex-1 overflow-y-auto p-6">
            <Card className="mx-auto max-w-xl p-6">
              <div className="mb-1 flex items-center gap-2">
                <Sparkles size={18} className="text-accent" />
                <h3 className="font-semibold">Claude aboneliğinle kullan (ücretsiz, API gerekmez)</h3>
              </div>
              <p className="mb-4 text-sm text-muted">
                Bir soru seç. Verilerinin özeti ve sorun panoya kopyalanır, claude.ai tarayıcıda açılır. Orada mesaj kutusuna
                tıklayıp <b>Ctrl+V</b> ile yapıştır ve <b>Enter</b>'a bas.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q.label}
                    onClick={() => openInClaude(q.prompt)}
                    className="rounded-xl border border-border bg-surface-2/50 p-3 text-left text-sm font-medium transition hover:border-accent/50 hover:bg-surface-2"
                  >
                    <span className="mr-1.5">{q.icon}</span>
                    {q.label}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <Input
                  placeholder="Ya da kendi sorunu yaz…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && input.trim() && openInClaude(input.trim())}
                />
                <Button variant="primary" disabled={!input.trim()} onClick={() => openInClaude(input.trim())}>
                  claude.ai'de sor
                </Button>
              </div>
            </Card>
            {isDesktop && (
              <>
                <div className="mx-auto my-5 max-w-xl text-center text-xs text-subtle">— ya da cevaplar uygulamanın içinde gelsin —</div>
                <KeySetup onSaved={() => setHasKey(true)} />
              </>
            )}
          </div>
        ) : (
          <>
            <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
              {messages.length === 0 && !showStreaming && (
                <div className="mx-auto max-w-2xl pt-6 text-center">
                  <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-accent to-accent-2 text-white shadow-glow">
                    <Sparkles size={26} />
                  </div>
                  <h2 className="text-lg font-semibold">Merhaba{settings.name ? `, ${settings.name}` : ''}! Bugün ne yapalım?</h2>
                  <p className="mt-1 text-sm text-muted">
                    Çalışma sürelerin, denemelerin, konu ilerlemen ve hata defterin otomatik olarak analiz edilir.
                  </p>
                  <div className="mt-6 grid grid-cols-2 gap-2.5 text-left">
                    {QUICK_PROMPTS.map((q) => (
                      <button
                        key={q.label}
                        onClick={() => send(q.prompt)}
                        className="group rounded-xl border border-border bg-surface-2/50 p-3.5 transition hover:border-accent/50 hover:bg-surface-2"
                      >
                        <div className="text-sm font-medium">
                          <span className="mr-1.5">{q.icon}</span>
                          {q.label}
                        </div>
                        <div className="mt-1 line-clamp-2 text-xs text-muted">{q.prompt}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m) => (
                <MessageBubble key={m.id} m={m} />
              ))}
              {showStreaming && (
                <MessageBubble m={{ id: 'stream', role: 'assistant', content: streaming.text, createdAt: '' }} streaming />
              )}
            </div>

            <div className="border-t border-border p-4">
              <div className="flex items-end gap-2 rounded-2xl border border-border bg-surface-2 p-2 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      send(input)
                    }
                  }}
                  placeholder="Koçuna bir şey sor… (Enter gönder, Shift+Enter yeni satır)"
                  className="max-h-40 min-h-[36px] flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-subtle"
                  style={{ height: Math.min(160, 36 + (input.split('\n').length - 1) * 20) }}
                />
                {streaming ? (
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => window.api?.ai.abort(streaming.requestId)}
                    aria-label="Durdur"
                  >
                    <Square size={14} />
                  </Button>
                ) : (
                  <Button variant="primary" size="icon" className="h-9 w-9" disabled={!input.trim()} onClick={() => send(input)} aria-label="Gönder">
                    <ArrowUp size={16} />
                  </Button>
                )}
              </div>
              <p className="mt-2 text-center text-[11px] text-subtle">
                AI yanılabilir; önemli kararları kendi değerlendirmenle birlikte ver. Puan tahminleri yaklaşıktır.
              </p>
            </div>
          </>
        )}
      </Card>

      <Modal
        open={showContext}
        onClose={() => setShowContext(false)}
        title="AI'ye gönderilen bağlam"
        subtitle="Her mesajda verilerinin bu özeti Claude'a iletilir (API anahtarın dışında hiçbir yere gönderilmez)."
        width={760}
      >
        <pre className="whitespace-pre-wrap rounded-lg bg-surface-2 p-4 text-xs leading-relaxed text-muted">{context}</pre>
      </Modal>
    </div>
  )
}
