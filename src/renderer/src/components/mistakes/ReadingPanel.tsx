// Paragraf sorusu için "Metin üstünde çözüm": paragraf, kanıt cümlesi vurgulu; şıklar adım adım elenir.
import { useMemo, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Loader2, RefreshCw, ScanText, X } from 'lucide-react'
import type { MistakeNote, ParaReading } from '../../../../shared/types'
import { Button, cn, confirm } from '@/components/ui'
import { AiError } from '@/lib/aiRunner'
import { formatDate } from '@/lib/date'
import { TRAP_LABEL, generateReading, locate } from '@/lib/paragraph'
import { useStore } from '@/lib/store'

type Span = { start: number; end: number; kind: 'evidence' | 'decoy' }

function spansOf(r: ParaReading, showDecoys: boolean): { spans: Span[]; missing: string[] } {
  const spans: Span[] = []
  const missing: string[] = []
  const add = (q: string, kind: Span['kind']): void => {
    const at = locate(r.passage, q)
    if (!at) return void (kind === 'evidence' && missing.push(q))
    // çakışanı atla (kanıt önceliklidir)
    if (spans.some((s) => at[0] < s.end && at[1] > s.start)) return
    spans.push({ start: at[0], end: at[1], kind })
  }
  r.evidence.forEach((q) => add(q, 'evidence'))
  if (showDecoys) (r.decoys ?? []).forEach((q) => add(q, 'decoy'))
  return { spans: spans.sort((a, b) => a.start - b.start), missing }
}

function Passage({ reading, stage }: { reading: ParaReading; stage: number }): React.JSX.Element {
  const showEvidence = stage >= 1
  const { spans, missing } = useMemo(() => spansOf(reading, stage >= 2), [reading, stage])
  const parts: React.ReactNode[] = []
  let at = 0
  if (showEvidence)
    spans.forEach((s, i) => {
      if (s.start > at) parts.push(reading.passage.slice(at, s.start))
      parts.push(
        <mark
          key={i}
          className={cn(
            'rounded-[3px] px-0.5 text-text transition-colors',
            s.kind === 'evidence' ? 'bg-success/20 underline decoration-success decoration-2 underline-offset-[3px]' : 'bg-danger/15 underline decoration-danger/50 decoration-dotted underline-offset-[3px]'
          )}
          title={s.kind === 'evidence' ? 'Kanıt cümlesi' : 'Tuzak şıkkın dayandığı ifade'}
        >
          {reading.passage.slice(s.start, s.end)}
        </mark>
      )
      at = s.end
    })
  parts.push(reading.passage.slice(at))
  return (
    <div>
      <p className="whitespace-pre-wrap text-[15px] leading-[1.85] text-text">{parts}</p>
      {showEvidence && missing.length > 0 && (
        <div className="mt-3 space-y-1">
          {missing.map((q, i) => (
            <p key={i} className="border-l-2 border-success pl-3 text-sm italic text-text">
              “{q}”
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

function Reading({ reading, note }: { reading: ParaReading; note: MistakeNote }): React.JSX.Element {
  const total = 2 + reading.options.length // 0: metin, 1: kanıt, 2..: şıklar tek tek
  const [stage, setStage] = useState(0)
  const shown = Math.max(0, stage - 1) // açılmış şık sayısı
  const done = stage >= total

  const label = stage === 0 ? 'Önce kökü ve metni oku' : stage === 1 ? 'Kanıt cümlesi' : done ? 'Tüm şıklar' : `${reading.options[shown - 1]?.letter} şıkkı`

  return (
    <div>
      {reading.stem && (
        <p className="mb-3 text-sm font-medium text-text">
          <span className="mr-1.5 text-[11px] font-semibold uppercase tracking-wide text-subtle">Soru</span>
          {reading.stem}
        </p>
      )}
      <div className="rounded-xl border border-border bg-surface px-5 py-4">
        <Passage reading={reading} stage={stage} />
      </div>
      {stage >= 1 && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-4 rounded-sm bg-success/25" /> Kanıt
          </span>
          {stage >= 2 && (reading.decoys?.length ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-4 rounded-sm bg-danger/15" /> Tuzağın dayandığı yer
            </span>
          )}
        </div>
      )}

      {stage >= 2 && (
        <ul className="mt-4 space-y-1.5">
          {reading.options.slice(0, shown).map((o) => {
            const mine = note.myAnswer === o.letter
            return (
              <li
                key={o.letter}
                className={cn(
                  'flex animate-fade-in gap-3 rounded-lg border px-3 py-2',
                  o.correct ? 'border-success/40 bg-success/5' : 'border-border'
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full',
                    o.correct ? 'bg-success text-white' : 'bg-surface-3 text-muted'
                  )}
                >
                  {o.correct ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
                </span>
                <div className="min-w-0 text-sm">
                  <div className={cn('text-text', !o.correct && 'text-muted')}>
                    <b className="mr-1">{o.letter})</b>
                    {o.text}
                    {mine && <span className="ml-2 rounded bg-danger/15 px-1.5 py-px text-[10px] font-semibold text-danger">senin seçimin</span>}
                  </div>
                  <div className="mt-0.5 text-[13px] leading-relaxed text-muted">
                    {o.trap && <span className="mr-1.5 font-medium text-warning">{TRAP_LABEL[o.trap]}:</span>}
                    {o.reason}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {done && (reading.steps?.length ?? 0) > 0 && (
        <div className="mt-4 rounded-xl bg-surface-2 px-4 py-3">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-subtle">Bu soruyu böyle oku</div>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-text">
            {reading.steps!.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        <Button variant="ghost" size="sm" disabled={stage === 0} icon={<ChevronLeft size={14} />} onClick={() => setStage((s) => s - 1)}>
          Geri
        </Button>
        <span className="text-xs text-muted">{label}</span>
        <div className="ml-auto flex gap-2">
          {!done && (
            <Button variant="ghost" size="sm" onClick={() => setStage(total)}>
              Hepsini göster
            </Button>
          )}
          <Button variant="outline" size="sm" disabled={done} onClick={() => setStage((s) => s + 1)}>
            İleri <ChevronRight size={14} />
          </Button>
        </div>
      </div>
    </div>
  )
}

export function ReadingPanel({ note }: { note: MistakeNote }): React.JSX.Element {
  const update = useStore((s) => s.updateMistakeNote)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const reading = note.paragraph?.reading
  const hasImg = (note.questionImages?.length ?? 0) > 0

  const run = async (): Promise<void> => {
    if (busy) return
    if (reading && !(await confirm({ title: 'Yeniden hazırlansın mı?', message: 'Mevcut metin üstünde çözüm yenisiyle değişir.', confirmText: 'Yenile', danger: false })))
      return
    setBusy(true)
    setError('')
    try {
      const cur = useStore.getState().data.mistakeNotes.find((m) => m.id === note.id) ?? note
      const r = await generateReading(cur)
      const latest = useStore.getState().data.mistakeNotes.find((m) => m.id === note.id)
      update(note.id, { paragraph: { ...latest?.paragraph, reading: r } })
    } catch (e) {
      setError(e instanceof AiError || e instanceof Error ? e.message : 'Hazırlanamadı')
    } finally {
      setBusy(false)
    }
  }

  if (!reading)
    return (
      <div>
        <p className="mb-3 max-w-xl text-xs leading-relaxed text-muted">
          AI paragrafı metne aktarır, cevabı kanıtlayan cümleyi metin üstünde işaretler ve şıkları tek tek neden doğru / yanlış olduklarıyla eler.
          {!hasImg && ' (Önce soruya görsel ekle.)'}
        </p>
        <Button
          variant="outline"
          size="sm"
          disabled={busy || !hasImg}
          icon={busy ? <Loader2 size={13} className="animate-spin" /> : <ScanText size={13} />}
          onClick={() => void run()}
        >
          {busy ? 'Hazırlanıyor…' : 'Metin üstünde çöz'}
        </Button>
        {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      </div>
    )

  return (
    <div>
      <Reading key={reading.createdAt} reading={reading} note={note} />
      <div className="mt-3 flex items-center gap-2 border-t border-border pt-3 text-[11px] text-subtle">
        <span>
          {formatDate(reading.createdAt.slice(0, 10))}
          {reading.model && ` · ${reading.model}`}
        </span>
        <Button className="ml-auto" variant="ghost" size="sm" disabled={busy} icon={busy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} onClick={() => void run()}>
          {busy ? 'Hazırlanıyor…' : 'Yeniden hazırla'}
        </Button>
      </div>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  )
}
