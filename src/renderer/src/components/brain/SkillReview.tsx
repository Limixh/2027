// Beceri tekrarı: sıradaki her beceri için AI yeni sorular üretir; öğrenci kâğıtta çözüp her soruyu
// dürüstçe işaretler. Sonuç beceriye kanıt olarak yazılır ve bir sonraki tekrar günü planlanır.
import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ArrowRight, Check, Eye, Loader2, RefreshCw, SkipForward, X } from 'lucide-react'
import { SUBJECT_MAP } from '@/data/curriculum'
import { Button, Modal, cn, toast } from '@/components/ui'
import { AiError, askAiWithModel, TUTOR_SYSTEM } from '@/lib/aiRunner'
import { rootCauses, sortedSkills, STATUS_COLOR, STATUS_LABEL } from '@/lib/brain'
import { useStore } from '@/lib/store'
import { KIND_META, groupTopics, topicShort, type SkillRow } from './shared'

const SEP = '---CEVAPLAR---'
const COUNT = 2

type Result = 'solved' | 'helped' | 'failed'
const RESULT_META: Record<Result, { label: string; color: string }> = {
  solved: { label: 'Kendim çözdüm', color: '#5f9e7a' },
  helped: { label: 'Bakarak', color: '#bd934c' },
  failed: { label: 'Çözemedim', color: '#c46e6e' }
}

function reviewPrompt(s: SkillRow, all: SkillRow[]): string {
  const where = groupTopics(s)
    .map((g) => `${SUBJECT_MAP[g.subjectId]?.name ?? g.subjectId}: ${g.topics.map((t) => t.name).join(', ')}`)
    .join(' · ')
  const ev = s.evidence
    .filter((e) => e.kind !== 'basari' && e.detail)
    .slice(-5)
    .map((e) => `- ${e.date}${e.topicId ? ` (${topicShort(e.topicId)})` : ''}: ${e.detail}`)
    .join('\n')
  const roots = rootCauses(s, all).map((r) => r.name)
  return `Öğrencim bu BECERİYİ tekrar ediyor: "${s.name}"${s.description ? ` — ${s.description}` : ''}
Durumu: ${STATUS_LABEL[s.strength.status]} (${s.strength.score}/100).${where ? `\nBu beceri şu konularda karşısına çıktı: ${where}` : ''}${ev ? `\nDaha önce tam olarak nerede takıldı:\n${ev}` : ''}${roots.length ? `\nDayandığı ve henüz oturmamış temel beceriler: ${roots.join(', ')} (soruların bunları da biraz yoklasın).` : ''}

Bu beceriyi doğrudan ölçen ${COUNT} YENİ soru yaz. YKS (ÖSYM) tarzı, 5 seçenekli (A-E). Birincisi orta, ikincisi biraz daha zor olsun.${where.includes(',') || groupTopics(s).length > 1 ? ' Mümkünse iki soru FARKLI konulardan olsun ki beceri iki kılıkta görülsün.' : ''} Takıldığı noktaları hedefle ama soruda ipucu verme. Kısa tut.

Biçim (kesinlikle uy):
### Soru 1
(soru)
A) ... B) ... C) ... D) ... E) ...
### Soru 2
(soru)
A) ... B) ... C) ... D) ... E) ...

${SEP}
1. Doğru seçenek — kısa çözüm (2-4 satır, kritik adımı vurgula)
2. Doğru seçenek — kısa çözüm`
}

const Md = ({ children }: { children: string }): React.JSX.Element => (
  <div className="prose-ai">
    <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
  </div>
)

export function SkillReview({ ids, onClose }: { ids: string[]; onClose: () => void }): React.JSX.Element | null {
  const [index, setIndex] = useState(0)
  const done = useRef<{ name: string; solved: number }[]>([])
  const finished = index >= ids.length

  useEffect(() => {
    if (!finished) return
    const d = done.current
    if (d.length) {
      const full = d.filter((x) => x.solved === COUNT).length
      toast(`Beceri tekrarı bitti: ${d.length} beceri, ${full} tanesinde hepsini çözdün`)
    }
    onClose()
  }, [finished, onClose])

  if (finished) return null
  return (
    <ReviewStep
      key={ids[index]}
      skillId={ids[index]}
      position={index + 1}
      total={ids.length}
      onClose={onClose}
      onNext={(r) => {
        if (r) done.current.push(r)
        setIndex((i) => i + 1)
      }}
    />
  )
}

function ReviewStep({
  skillId,
  position,
  total,
  onClose,
  onNext
}: {
  skillId: string
  position: number
  total: number
  onClose: () => void
  onNext: (r?: { name: string; solved: number }) => void
}): React.JSX.Element {
  const record = useStore((s) => s.recordSkillPractice)
  // İlk çizimde sabitlenir: kayıt sonrası puan değişse de bu adımın içeriği oynamaz
  const [all] = useState<SkillRow[]>(() => sortedSkills(useStore.getState().data))
  const s = all.find((x) => x.id === skillId)

  const [text, setText] = useState('')
  const [model, setModel] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [reveal, setReveal] = useState(false)
  const [results, setResults] = useState<(Result | null)[]>(() => Array(COUNT).fill(null))
  const started = useRef(false)

  const generate = async (): Promise<void> => {
    if (!s) return
    setBusy(true)
    setError('')
    setText('')
    setReveal(false)
    setResults(Array(COUNT).fill(null))
    try {
      const r = await askAiWithModel({ system: TUTOR_SYSTEM, prompt: reviewPrompt(s, all), onText: setText })
      setText(r.text)
      setModel(r.model)
    } catch (e) {
      setError(e instanceof AiError || e instanceof Error ? e.message : 'Sorular üretilemedi')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (started.current) return
    started.current = true
    if (s) void generate()
    else onNext() // bu arada silinmiş
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!s) return <></>

  const idx = text.indexOf(SEP)
  const questions = (idx >= 0 ? text.slice(0, idx) : text).trim()
  const answers = idx >= 0 ? text.slice(idx + SEP.length).trim() : ''
  const allMarked = results.every(Boolean)
  const color = STATUS_COLOR[s.strength.status]
  const roots = rootCauses(s, all)

  const save = (): void => {
    const solved = results.filter((r) => r === 'solved').length
    const helped = results.filter((r) => r === 'helped').length
    record(s.id, { solved, total: COUNT, source: 'beceri', detail: helped ? `${helped} soruda çözüme baktı` : undefined })
    onNext({ name: s.name, solved })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Beceri tekrarı"
      subtitle={`${position} / ${total} · kâğıdında çöz, sonra cevaplara bakıp her soruyu dürüstçe işaretle`}
      width={860}
      footer={
        <>
          <Button variant="ghost" className="mr-auto" icon={<SkipForward size={14} />} onClick={() => onNext()}>
            Bu beceriyi atla
          </Button>
          {!reveal ? (
            <Button variant="primary" icon={<Eye size={14} />} disabled={busy || !answers} onClick={() => setReveal(true)}>
              Cevapları göster
            </Button>
          ) : (
            <Button variant="primary" disabled={!allMarked} onClick={save}>
              Kaydet{position < total ? ' ve sonraki' : ' ve bitir'}
              {position < total && <ArrowRight size={14} />}
            </Button>
          )}
        </>
      }
    >
      <div className="mb-4 h-1 overflow-hidden rounded-full bg-surface-3">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${((position - 1) / total) * 100}%` }} />
      </div>

      <div className="mb-5">
        {s.area && <div className="text-[11px] font-medium uppercase tracking-wider text-subtle">{s.area}</div>}
        <h2 className="text-xl font-semibold tracking-tight">{s.name}</h2>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
            {STATUS_LABEL[s.strength.status]} · <span className="tabular">{s.strength.score}</span>
          </span>
          {s.topicIds.length > 0 && <span>{s.topicIds.map(topicShort).slice(0, 4).join(' · ')}</span>}
        </div>
        {roots.length > 0 && (
          <p className="mt-2 text-xs text-warning">
            Temeli henüz oturmamış: {roots.map((r) => `“${r.name}”`).join(', ')}. Bu sorularda onlar da yoklanıyor.
          </p>
        )}
      </div>

      {error && (
        <div className="mb-3 flex items-start justify-between gap-3 rounded-lg border border-danger/30 px-3.5 py-2.5 text-xs text-danger">
          <span>{error}</span>
          <button type="button" className="shrink-0 font-medium underline" onClick={() => void generate()}>
            Tekrar dene
          </button>
        </div>
      )}

      {questions ? (
        <Md>{questions}</Md>
      ) : (
        busy && (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Loader2 size={14} className="animate-spin" /> Sana özel sorular hazırlanıyor…
          </p>
        )
      )}
      {!busy && model && (
        <div className="mt-2 flex items-center gap-3 text-[11px] text-subtle">
          <span>{model}</span>
          {!reveal && (
            <button type="button" className="inline-flex items-center gap-1 hover:text-text" onClick={() => void generate()}>
              <RefreshCw size={11} /> Başka sorular
            </button>
          )}
        </div>
      )}

      {reveal && (
        <div className="mt-5 animate-fade-in border-t border-border pt-4">
          <Md>{answers}</Md>
          <div className="mt-5 space-y-2.5">
            {results.map((r, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <span className="w-16 text-xs font-medium text-muted">Soru {i + 1}</span>
                {(Object.keys(RESULT_META) as Result[]).map((k) => {
                  const m = RESULT_META[k]
                  const on = r === k
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setResults((v) => v.map((x, j) => (j === i ? k : x)))}
                      className={cn(
                        'inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors',
                        !on && 'border-border bg-surface-2 text-muted hover:text-text'
                      )}
                      style={on ? { borderColor: m.color, background: m.color + '1f', color: m.color } : undefined}
                    >
                      {k === 'solved' ? <Check size={12} /> : k === 'failed' ? <X size={12} /> : null}
                      {m.label}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-subtle">
            Hepsini kendin çözersen sonraki tekrar daha ileri bir güne atılır ({KIND_META.basari.label.toLowerCase()} kanıtı); çözemezsen yarın tekrar gelir.
          </p>
        </div>
      )}
    </Modal>
  )
}
