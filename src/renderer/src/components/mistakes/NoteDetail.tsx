import { useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Check, Eye, EyeOff, Pencil, RefreshCw, RotateCcw, Sparkles, Trash2, X } from 'lucide-react'
import type { MistakeKind, MistakeNote } from '../../../../shared/types'
import { Badge, Button, Modal, Select, cn, toast } from '@/components/ui'
import { SUBJECT_MAP, TOPIC_MAP } from '@/data/curriculum'
import { MISTAKE_KIND_LABEL } from '@/lib/exam'
import { formatDate, todayKey } from '@/lib/date'
import { AiError, TUTOR_SYSTEM, analysisPrompt, askAi, similarPrompt, splitNoteMeta } from '@/lib/aiRunner'
import { resolveTopic } from '@/lib/aiActions'
import { uid } from '@/lib/id'
import { useStore } from '@/lib/store'
import { KINDS } from './MistakeModal'
import { NoteImage } from './NoteImage'

const Md = ({ children }: { children: string }): React.JSX.Element => (
  <div className="prose-ai">
    <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
  </div>
)

function splitSimilar(md: string): { questions: string; answers: string } {
  const parts = md.split(/\n?-{3}\s*CEVAPLAR\s*-{3}[^\n]*\n?/i)
  return { questions: parts[0].trim(), answers: (parts[1] ?? '').trim() }
}

const errText = (e: unknown): string => (e instanceof AiError || e instanceof Error ? e.message : 'Bilinmeyen bir hata oluştu')

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }): React.JSX.Element {
  return (
    <section className="border-t border-border pt-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-subtle">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  )
}

export function NoteDetail({
  id,
  onClose,
  onEdit,
  onDelete
}: {
  id: string
  onClose: () => void
  onEdit: (n: MistakeNote) => void
  onDelete: (n: MistakeNote) => void
}): React.JSX.Element | null {
  const note = useStore((s) => s.data.mistakeNotes.find((m) => m.id === id))
  const update = useStore((s) => s.updateMistakeNote)
  const recordRetry = useStore((s) => s.recordRetry)

  const [retry, setRetry] = useState(false)
  const [retried, setRetried] = useState<boolean | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [live, setLive] = useState('')
  const [error, setError] = useState('')
  const [simBusy, setSimBusy] = useState(false)
  const [simLive, setSimLive] = useState('')
  const [simError, setSimError] = useState('')
  const [count, setCount] = useState(3)
  const [shown, setShown] = useState<Record<string, boolean>>({})
  const busy = useRef(false)

  const imgs = useMemo(() => [...(note?.questionImages ?? []), ...(note?.attemptImages ?? [])], [note?.questionImages, note?.attemptImages])
  if (!note) return null

  const subject = SUBJECT_MAP[note.subjectId]
  const topic = note.topicId ? TOPIC_MAP[note.topicId] : undefined
  const today = todayKey()
  const due = !!note.nextReview && note.nextReview <= today && !note.resolved
  const hasQ = (note.questionImages?.length ?? 0) > 0

  const analyze = async (): Promise<void> => {
    if (busy.current) return
    busy.current = true
    setAnalyzing(true)
    setError('')
    setLive('')
    try {
      const full = await askAi({
        system: TUTOR_SYSTEM,
        prompt: analysisPrompt({
          subject: subject?.name ?? 'YKS',
          topic: topic?.name,
          hasAttempt: (note.attemptImages?.length ?? 0) > 0,
          note: note.text || undefined
        }),
        attachments: imgs.length ? imgs : undefined,
        onText: setLive
      })
      const { body, meta } = splitNoteMeta(full)
      const patch: Partial<MistakeNote> = { aiAnalysis: body, aiAnalyzedAt: new Date().toISOString() }
      const cur = useStore.getState().data.mistakeNotes.find((m) => m.id === id)
      if (meta && cur) {
        if (meta.kind && (KINDS as string[]).includes(meta.kind)) patch.kind = meta.kind as MistakeKind
        if (meta.lesson && !cur.lesson) patch.lesson = meta.lesson
        if (!cur.topicId && meta.topic) {
          const t = resolveTopic(cur.subjectId, meta.topic)
          if (t) patch.topicId = t
        }
        if (meta.summary && !cur.text.trim()) patch.text = meta.summary
      }
      update(id, patch)
      setLive('')
    } catch (e) {
      setError(errText(e))
    } finally {
      busy.current = false
      setAnalyzing(false)
    }
  }

  const makeSimilar = async (): Promise<void> => {
    if (simBusy) return
    setSimBusy(true)
    setSimError('')
    setSimLive('')
    try {
      const full = await askAi({
        system: TUTOR_SYSTEM,
        prompt: similarPrompt({ subject: subject?.name ?? 'YKS', topic: topic?.name, count, analysis: note.aiAnalysis }),
        attachments: note.questionImages?.length ? note.questionImages : imgs.length ? imgs : undefined,
        onText: setSimLive
      })
      const cur = useStore.getState().data.mistakeNotes.find((m) => m.id === id)
      update(id, { similar: [...(cur?.similar ?? []), { id: uid(), markdown: full.trim(), createdAt: new Date().toISOString() }] })
      setSimLive('')
    } catch (e) {
      setSimError(errText(e))
    } finally {
      setSimBusy(false)
    }
  }

  const answer = (solved: boolean): void => {
    recordRetry(id, solved)
    setRetried(solved)
    setRetry(false)
    toast(solved ? 'Güzel! Bir sonraki tekrar planlandı.' : 'Sorun değil, yarın tekrar karşına çıkacak.', solved ? 'success' : 'info')
  }

  const analysisBody = analyzing ? splitNoteMeta(live).body || live.replace(/```yks-note[\s\S]*$/, '').trim() : note.aiAnalysis

  /* ---------- tekrar çözme: yalnızca soru görseli ---------- */
  if (retry) {
    return (
      <Modal
        open
        onClose={onClose}
        title="Tekrar çöz"
        subtitle={[subject?.name, topic?.name].filter(Boolean).join(' · ')}
        width={820}
        footer={
          <>
            <Button variant="ghost" className="mr-auto" onClick={() => setRetry(false)}>
              Vazgeç
            </Button>
            <Button variant="outline" icon={<X size={14} />} onClick={() => answer(false)}>
              Çözemedim
            </Button>
            <Button variant="primary" icon={<Check size={14} />} onClick={() => answer(true)}>
              Çözdüm
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {hasQ ? (
            note.questionImages!.map((a, i) => (
              <NoteImage key={a.rel + i} att={a} zoom className="rounded-lg border border-border bg-surface-2" imgClassName="mx-auto max-h-[56vh] w-auto max-w-full" />
            ))
          ) : (
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{note.text}</p>
          )}
          <p className="text-center text-xs text-subtle">Kendi kâğıdında çöz, sonra dürüstçe işaretle. Analiz ve cevaplar gizli.</p>
        </div>
      </Modal>
    )
  }

  const retries = [...(note.retries ?? [])].reverse()
  const sims = note.similar ?? []

  return (
    <Modal
      open
      onClose={onClose}
      title={topic?.name ?? subject?.name ?? 'Ders seçilmedi'}
      subtitle={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {topic && subject && <span>{subject.name}</span>}
          <span className="tabular">{formatDate(note.date)}</span>
          {note.source && <span>· {note.source}</span>}
        </span>
      }
      width={860}
      footer={
        <>
          <Button variant="ghost" className="mr-auto text-danger hover:bg-danger/10" icon={<Trash2 size={14} />} onClick={() => onDelete(note)}>
            Sil
          </Button>
          <Button variant="ghost" icon={<Pencil size={14} />} onClick={() => onEdit(note)}>
            Düzenle
          </Button>
          <Button variant="outline" icon={<RotateCcw size={14} />} onClick={() => setRetry(true)}>
            Tekrar çöz
          </Button>
          <Button
            variant={note.resolved ? 'outline' : 'primary'}
            icon={<Check size={14} />}
            onClick={() => {
              update(id, { resolved: !note.resolved, nextReview: note.resolved ? note.nextReview : undefined })
              toast(note.resolved ? 'Not yeniden açıldı' : 'Öğrenildi olarak işaretlendi', 'info')
            }}
          >
            {note.resolved ? 'Yeniden aç' : 'Öğrendim'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {note.inbox && (
          <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-3.5 py-2.5 text-xs text-muted">
            <span>Telefondan geldi. Ders ve konuyu seçip kaydedersen AI daha doğru analiz eder.</span>
            <Button size="sm" variant="outline" onClick={() => onEdit(note)}>
              Tamamla
            </Button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
          <Select
            value={note.kind}
            onChange={(e) => update(id, { kind: e.target.value as MistakeKind })}
            className="!h-7 !w-auto !py-0 text-xs"
            aria-label="Hata türü"
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {MISTAKE_KIND_LABEL[k]}
              </option>
            ))}
          </Select>
          {note.resolved ? (
            <Badge color="#51b896">
              <Check size={11} strokeWidth={3} /> Öğrenildi
            </Badge>
          ) : note.nextReview ? (
            <span className={cn(due && 'font-medium text-warning')}>
              Sonraki tekrar: <span className="tabular">{due ? 'bugün' : formatDate(note.nextReview)}</span>
            </span>
          ) : (
            <span>Tekrar planlanmadı</span>
          )}
          {retried !== null && <span>{retried ? 'Son deneme: çözdün' : 'Son deneme: çözemedin'}</span>}
        </div>

        {hasQ && (
          <div className="space-y-3">
            {note.questionImages!.map((a, i) => (
              <NoteImage key={a.rel + i} att={a} zoom className="rounded-lg border border-border bg-surface-2" imgClassName="mx-auto max-h-[60vh] w-auto max-w-full" />
            ))}
          </div>
        )}

        {note.text.trim() && <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">{note.text}</p>}

        {(note.attemptImages?.length ?? 0) > 0 && (
          <Section title="Benim çözümüm">
            <div className="grid grid-cols-2 gap-3">
              {note.attemptImages!.map((a, i) => (
                <NoteImage key={a.rel + i} att={a} zoom className="rounded-lg border border-border bg-surface-2" imgClassName="mx-auto max-h-72 w-auto max-w-full" />
              ))}
            </div>
          </Section>
        )}

        {note.lesson && (
          <Section title="Çıkardığım ders">
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{note.lesson}</p>
          </Section>
        )}

        <Section
          title="AI analizi"
          right={
            !analyzing && (
              <Button
                size="sm"
                variant={note.aiAnalysis ? 'ghost' : 'outline'}
                icon={note.aiAnalysis ? <RefreshCw size={13} /> : <Sparkles size={13} />}
                onClick={() => void analyze()}
              >
                {note.aiAnalysis ? 'Yeniden analiz et' : 'AI ile analiz et'}
              </Button>
            )
          }
        >
          {error && (
            <div className="mb-3 flex items-start justify-between gap-3 rounded-lg border border-danger/30 px-3.5 py-2.5 text-xs text-danger">
              <span>{error}</span>
              <button type="button" className="shrink-0 font-medium underline" onClick={() => void analyze()}>
                Tekrar dene
              </button>
            </div>
          )}
          {analysisBody ? (
            <div className={cn(analyzing && 'opacity-90')}>
              <Md>{analysisBody}</Md>
              {analyzing && <div className="mt-2 text-xs text-subtle">Yazılıyor…</div>}
              {!analyzing && note.aiAnalyzedAt && (
                <div className="mt-2 text-[11px] text-subtle">{formatDate(note.aiAnalyzedAt.slice(0, 10))} tarihinde analiz edildi</div>
              )}
            </div>
          ) : analyzing ? (
            <p className="text-xs text-subtle">AI soruyu inceliyor…</p>
          ) : (
            !error && (
              <p className="text-xs text-muted">
                {(note.attemptImages?.length ?? 0) > 0
                  ? 'AI, çözümünü satır satır inceleyip hatanın nerede ve neden olduğunu söyler.'
                  : 'AI soruyu çözer, nerede takılmış olabileceğini ve nasıl kaçırmayacağını anlatır.'}
              </p>
            )
          )}
        </Section>

        <Section
          title="Benzer sorular"
          right={
            <div className="flex items-center gap-2">
              <Select
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="!h-7 !w-auto !py-0 text-xs"
                aria-label="Soru sayısı"
                disabled={simBusy}
              >
                {[2, 3, 5].map((n) => (
                  <option key={n} value={n}>
                    {n} soru
                  </option>
                ))}
              </Select>
              <Button size="sm" variant="outline" icon={<Sparkles size={13} />} disabled={simBusy} onClick={() => void makeSimilar()}>
                {simBusy ? 'Üretiliyor…' : 'Benzer soru üret'}
              </Button>
            </div>
          }
        >
          {simError && (
            <div className="mb-3 flex items-start justify-between gap-3 rounded-lg border border-danger/30 px-3.5 py-2.5 text-xs text-danger">
              <span>{simError}</span>
              <button type="button" className="shrink-0 font-medium underline" onClick={() => void makeSimilar()}>
                Tekrar dene
              </button>
            </div>
          )}
          {simBusy && simLive && <Md>{splitSimilar(simLive).questions}</Md>}
          {sims.length === 0 && !simBusy && !simError && (
            <p className="text-xs text-muted">Aynı kazanımı ölçen yeni sorularla bu konuyu pekiştir.</p>
          )}
          <div className="space-y-5">
            {[...sims].reverse().map((s, idx) => {
              const { questions, answers } = splitSimilar(s.markdown)
              const open = shown[s.id]
              return (
                <div key={s.id} className={cn(idx > 0 && 'border-t border-border pt-4')}>
                  <div className="mb-2 text-[11px] text-subtle">{formatDate(s.createdAt.slice(0, 10))}</div>
                  <Md>{questions}</Md>
                  {answers && (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => setShown((p) => ({ ...p, [s.id]: !open }))}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
                      >
                        {open ? <EyeOff size={13} /> : <Eye size={13} />}
                        {open ? 'Cevapları gizle' : 'Cevapları göster'}
                      </button>
                      {open && (
                        <div className="mt-2 animate-fade-in">
                          <Md>{answers}</Md>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Section>

        <Section title="Tekrar geçmişi">
          {retries.length === 0 ? (
            <p className="text-xs text-muted">Henüz tekrar çözmedin. “Tekrar çöz” ile farklı bir günde dene.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {retries.map((r, i) => (
                <li key={i} className="flex items-center justify-between py-1.5">
                  <span className="tabular text-muted">{formatDate(r.date)}</span>
                  <span className={r.solved ? 'text-success' : 'text-warning'}>{r.solved ? 'Çözdüm' : 'Çözemedim'}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </Modal>
  )
}
