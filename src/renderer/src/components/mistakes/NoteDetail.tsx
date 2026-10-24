import { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Eye, EyeOff, Pencil, RefreshCw, RotateCcw, Sparkles, Trash2, X } from 'lucide-react'
import type { MistakeKind, MistakeNote } from '../../../../shared/types'
import { Badge, Button, Modal, Select, Textarea, cn, toast } from '@/components/ui'
import { SUBJECT_MAP, TOPIC_MAP } from '@/data/curriculum'
import { MISTAKE_KIND_LABEL } from '@/lib/exam'
import { formatDate, todayKey } from '@/lib/date'
import { AiError, TUTOR_SYSTEM, askAiWithModel, similarPrompt, splitNoteMeta } from '@/lib/aiRunner'
import { analyzeNote } from '@/lib/analyzeNote'
import { uid } from '@/lib/id'
import { useStore } from '@/lib/store'
import { skillStrength, STATUS_COLOR, STATUS_LABEL } from '@/lib/brain'
import { useNav } from '@/lib/nav'
import { KINDS } from './MistakeModal'
import { NoteImage } from './NoteImage'
import { FollowUps } from './FollowUps'
import { BoardPanel } from '@/components/board/BoardPanel'

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

/** Önceki / sonraki soru (sayfa görünümünde) */
export interface NoteNav {
  position: number
  total: number
  prev?: () => void
  next?: () => void
}

/** Detayın çerçevesi: açılır pencere ya da tam sayfa (Hata Defteri) */
function Shell({
  page,
  onClose,
  title,
  subtitle,
  actions,
  nav,
  children
}: {
  page: boolean
  onClose: () => void
  title: React.ReactNode
  subtitle?: React.ReactNode
  actions: React.ReactNode
  nav?: NoteNav
  children: React.ReactNode
}): React.JSX.Element {
  // Sayfada: Esc geri döner, ← → önceki / sonraki (yazı yazarken ya da açık pencere varken değil)
  useEffect(() => {
    if (!page) return
    const onKey = (e: KeyboardEvent): void => {
      const t = e.target instanceof Element ? e.target : null
      if (document.querySelector('[role=dialog]') || t?.closest('input, textarea, select, [contenteditable]')) return
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && nav?.prev) nav.prev()
      else if (e.key === 'ArrowRight' && nav?.next) nav.next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [page, onClose, nav])

  if (!page)
    return (
      <Modal open onClose={onClose} title={title} subtitle={subtitle} width={860} footer={actions}>
        {children}
      </Modal>
    )
  return (
    <div className="animate-fade-in">
      <div className="sticky top-10 z-20 -mx-8 mb-6 border-b border-border bg-bg/90 px-8 pb-3 pt-1 backdrop-blur">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <Button variant="ghost" size="sm" icon={<ArrowLeft size={15} />} onClick={onClose} title="Esc">
            Hata Defteri
          </Button>
          {nav && nav.total > 1 && (
            <div className="flex items-center gap-1 text-xs text-muted">
              <Button variant="ghost" size="icon" disabled={!nav.prev} onClick={nav.prev} aria-label="Önceki soru" title="Önceki (←)">
                <ChevronLeft size={16} />
              </Button>
              <span className="tabular min-w-[48px] text-center">
                {nav.position} / {nav.total}
              </span>
              <Button variant="ghost" size="icon" disabled={!nav.next} onClick={nav.next} aria-label="Sonraki soru" title="Sonraki (→)">
                <ChevronRight size={16} />
              </Button>
            </div>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold leading-tight tracking-tight">{title}</h1>
            {subtitle && <div className="mt-0.5 text-xs text-muted">{subtitle}</div>}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>
        </div>
      </div>
      {children}
    </div>
  )
}

export function NoteDetail({
  id,
  onClose,
  onEdit,
  onDelete,
  page = false,
  nav
}: {
  id: string
  onClose: () => void
  onEdit: (n: MistakeNote) => void
  onDelete: (n: MistakeNote) => void
  /** Açılır pencere yerine geniş sayfa olarak göster */
  page?: boolean
  nav?: NoteNav
}): React.JSX.Element | null {
  const note = useStore((s) => s.data.mistakeNotes.find((m) => m.id === id))
  const allSkills = useStore((s) => s.data.skills)
  const linkedSkills = useMemo(
    () =>
      (note?.skillIds ?? [])
        .map((sid) => allSkills.find((k) => k.id === sid))
        .filter((k): k is NonNullable<typeof k> => !!k)
        .map((k) => ({ ...k, st: skillStrength(k) })),
    [note?.skillIds, allSkills]
  )
  const update = useStore((s) => s.updateMistakeNote)
  const recordRetry = useStore((s) => s.recordRetry)
  const addComment = useStore((s) => s.addNoteComment)
  const deleteComment = useStore((s) => s.deleteNoteComment)
  const [retryComment, setRetryComment] = useState('')
  const [comment, setComment] = useState('')

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
  const analysisRef = useRef<HTMLDivElement>(null)
  const boardOn = useStore((s) => s.data.settings.boardSolutions ?? true)

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
      await analyzeNote(id, setLive)
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
      const { text: full, model } = await askAiWithModel({
        system: TUTOR_SYSTEM,
        prompt: similarPrompt({ subject: subject?.name ?? 'YKS', topic: topic?.name, count, analysis: note.aiAnalysis }),
        attachments: note.questionImages?.length ? note.questionImages : imgs.length ? imgs : undefined,
        onText: setSimLive
      })
      const cur = useStore.getState().data.mistakeNotes.find((m) => m.id === id)
      update(id, { similar: [...(cur?.similar ?? []), { id: uid(), markdown: full.trim(), createdAt: new Date().toISOString(), model }] })
      setSimLive('')
    } catch (e) {
      setSimError(errText(e))
    } finally {
      setSimBusy(false)
    }
  }

  const answer = (solved: boolean, help = false): void => {
    if (retryComment.trim()) addComment(id, `[Tekrar: ${solved && !help ? 'çözdüm' : help ? 'çözüme bakarak' : 'çözemedim'}] ${retryComment.trim()}`)
    setRetryComment('')
    recordRetry(id, solved, help)
    setRetried(solved && !help)
    setRetry(false)
    toast(
      help ? 'Not edildi: 2 gün sonra çözüme bakmadan tekrar dene.' : solved ? 'Güzel! Bir sonraki tekrar planlandı.' : 'Sorun değil, yarın tekrar karşına çıkacak.',
      solved && !help ? 'success' : 'info'
    )
  }

  const analysisBody = analyzing ? splitNoteMeta(live).body || live.replace(/```yks-note[\s\S]*$/, '').trim() : note.aiAnalysis

  /* ---------- tekrar çözme: yalnızca soru görseli ---------- */
  if (retry) {
    return (
      <Shell
        page={page}
        onClose={onClose}
        title="Tekrar çöz"
        subtitle={[subject?.name, topic?.name].filter(Boolean).join(' · ')}
        actions={
          <>
            <Button variant="ghost" className={cn(!page && 'mr-auto')} onClick={() => setRetry(false)}>
              Vazgeç
            </Button>
            <Button variant="outline" icon={<X size={14} />} onClick={() => answer(false)}>
              Çözemedim
            </Button>
            <Button variant="outline" onClick={() => answer(false, true)} title="Çözdün ama çözüme bakarak">
              Çözüme bakarak
            </Button>
            <Button variant="primary" icon={<Check size={14} />} onClick={() => answer(true)}>
              Çözdüm
            </Button>
          </>
        }
      >
        <div className={cn('space-y-4', page && 'mx-auto max-w-4xl')}>
          {hasQ ? (
            note.questionImages!.map((a, i) => (
              <NoteImage
                key={a.rel + i}
                att={a}
                zoom
                className="rounded-lg border border-border bg-surface-2"
                imgClassName={cn('mx-auto w-auto max-w-full', page ? 'max-h-[68vh]' : 'max-h-[56vh]')}
              />
            ))
          ) : (
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{note.text}</p>
          )}
          <p className="text-center text-xs text-subtle">Kendi kâğıdında çöz, sonra dürüstçe işaretle. Analiz ve cevaplar gizli.</p>
          <Textarea
            rows={2}
            value={retryComment}
            onChange={(e) => setRetryComment(e.target.value)}
            placeholder="Yorum (isteğe bağlı): bu sefer nerede takıldın / ne fark ettin?"
          />
        </div>
      </Shell>
    )
  }

  const retries = [...(note.retries ?? [])].reverse()
  const sims = note.similar ?? []

  const metaTop = (
    <>
      {note.inbox && (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-3.5 py-2.5 text-xs text-muted">
          <span>Telefondan geldi. Ders ve konuyu seçip kaydedersen AI daha doğru analiz eder.</span>
          <Button size="sm" variant="outline" onClick={() => onEdit(note)}>
            Tamamla
          </Button>
        </div>
      )}

      {linkedSkills.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-muted">Beceriler:</span>
          {linkedSkills.map((sk) => (
            <button
              key={sk.id}
              onClick={() => {
                onClose()
                useNav.getState().go('brain', { skill: sk.id })
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-xs text-text transition hover:bg-surface-2"
              title={`${STATUS_LABEL[sk.st.status]} · ${sk.topicIds.length} konuda`}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLOR[sk.st.status] }} />
              {sk.name}
              {sk.topicIds.length > 1 && <span className="text-muted">· {sk.topicIds.length} konu</span>}
            </button>
          ))}
        </div>
      )}

      {(note.correctAnswer || note.myAnswer || note.usedSolution || note.usedHint) && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
          {note.correctAnswer && (
            <span className="text-muted">
              Doğru cevap: <b className="text-success">{note.correctAnswer}</b>
            </span>
          )}
          {note.myAnswer && (
            <span className="text-muted">
              Benim cevabım: <b className={note.myAnswer === note.correctAnswer ? 'text-success' : 'text-danger'}>{note.myAnswer}</b>
            </span>
          )}
          {note.usedSolution && <span className="text-[#4f9a95]">Çözüme bakarak yaptım</span>}
          {note.usedHint && !note.usedSolution && (
            <span className="text-[#4f9a95]">İpucuna baktım, gerisi benim{note.hintSeen ? `: “${note.hintSeen}”` : ''}</span>
          )}
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
    </>
  )

  const questionCol = (
    <>
      {hasQ && (
        <div className="space-y-3">
          {note.questionImages!.map((a, i) => (
            <NoteImage
              key={a.rel + i}
              att={a}
              zoom
              className="rounded-lg border border-border bg-surface-2"
              imgClassName={cn('mx-auto w-auto max-w-full', page ? 'max-h-[72vh]' : 'max-h-[60vh]')}
            />
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
    </>
  )

  return (
    <Shell
      page={page}
      onClose={onClose}
      nav={nav}
      title={topic?.name ?? subject?.name ?? 'Ders seçilmedi'}
      subtitle={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {topic && subject && <span>{subject.name}</span>}
          <span className="tabular">{formatDate(note.date)}</span>
          {note.source && <span>· {note.source}</span>}
        </span>
      }
      actions={
        <>
          <Button
            variant="ghost"
            className={cn('text-danger hover:bg-danger/10', !page && 'mr-auto')}
            icon={<Trash2 size={14} />}
            onClick={() => onDelete(note)}
          >
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
      <Body page={page} metaTop={metaTop} questionCol={questionCol}>
        <Section title="Yorumlarım">
          {note.comments?.length ? (
            <ul className="mb-3 space-y-2">
              {note.comments.map((c) => (
                <li key={c.id} className="group flex items-start gap-3 text-sm">
                  <span className="tabular w-20 shrink-0 pt-0.5 text-xs text-muted">{formatDate(c.date, false)}</span>
                  <p className="min-w-0 flex-1 whitespace-pre-wrap leading-relaxed">{c.text}</p>
                  <button
                    className="shrink-0 text-xs text-subtle opacity-0 transition hover:text-danger group-hover:opacity-100"
                    onClick={() => deleteComment(id, c.id)}
                  >
                    sil
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-3 text-xs text-muted">Nerede takıldığını kendi cümlelerinle yaz; AI analizi buna göre yapar.</p>
          )}
          <div className="flex items-end gap-2">
            <Textarea
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  addComment(id, comment)
                  setComment('')
                }
              }}
              placeholder="ör. Kök-katsayıyı doğru yazmıştım ama Δ'yı hesaplarken işaret hatası yaptım"
              className="min-h-[60px]"
            />
            <Button
              size="sm"
              disabled={!comment.trim()}
              onClick={() => {
                addComment(id, comment)
                setComment('')
              }}
            >
              Ekle
            </Button>
          </div>
        </Section>

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
              <div ref={analysisRef}>
                <Md>{analysisBody}</Md>
              </div>
              {analyzing && <div className="mt-2 text-xs text-subtle">Yazılıyor…</div>}
              {!analyzing && note.aiAnalyzedAt && (
                <div className="mt-2 text-[11px] text-subtle">
                  {formatDate(note.aiAnalyzedAt.slice(0, 10))} tarihinde analiz edildi{note.aiModel && ` · ${note.aiModel}`}
                </div>
              )}
              {!analyzing && note.aiAnalysis && (
                <FollowUps note={note} subject={subject?.name ?? 'YKS'} topic={topic?.name} images={imgs} analysisRef={analysisRef} />
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

        {boardOn && (
          <Section title="Tahtada çözüm">
            <BoardPanel note={note} />
          </Section>
        )}

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
                  <div className="mb-2 text-[11px] text-subtle">
                    {formatDate(s.createdAt.slice(0, 10))}
                    {s.model && ` · ${s.model}`}
                  </div>
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
                  <span className={r.solved ? 'text-success' : 'text-warning'}>{r.solved ? 'Çözdüm' : r.help ? 'Çözüme bakarak' : 'Çözemedim'}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </Body>
    </Shell>
  )
}

/**
 * Pencerede her şey alt alta; sayfada solda soru (kaydırırken sabit kalır), sağda analiz ve diğerleri.
 */
function Body({
  page,
  metaTop,
  questionCol,
  children
}: {
  page: boolean
  metaTop: React.ReactNode
  questionCol: React.ReactNode
  children: React.ReactNode
}): React.JSX.Element {
  if (!page)
    return (
      <div className="space-y-5">
        {metaTop}
        {questionCol}
        {children}
      </div>
    )
  return (
    <div className="grid gap-10 pb-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <div className="space-y-5 self-start lg:sticky lg:top-[7.5rem] lg:max-h-[calc(100vh-8.5rem)] lg:overflow-y-auto lg:pr-2">{questionCol}</div>
      <div className="min-w-0 space-y-5">
        {metaTop}
        {children}
      </div>
    </div>
  )
}
