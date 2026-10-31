// Paragraf / anlam sorusu için ek alanlar: soru tipi (boşsa AI belirler), arada kalınan şıklar, süre, neden o şık.
import { useState } from 'react'
import type { ParagraphInfo, ParaQType } from '../../../../shared/types'
import { Input, Select, Textarea, cn } from '@/components/ui'
import { QTYPE_LABEL, fmtSeconds, parseSeconds, topicQType } from '@/lib/paragraph'

const LETTERS = ['A', 'B', 'C', 'D', 'E']

/** Boş alanları atar; hiçbir şey girilmediyse undefined */
export function cleanParagraph(p: ParagraphInfo | undefined): ParagraphInfo | undefined {
  if (!p) return undefined
  const out: ParagraphInfo = { ...p }
  if (!out.qType) delete out.qTypeAuto
  if (!out.between?.length) delete out.between
  if (!out.why?.trim()) delete out.why
  else out.why = out.why.trim()
  if (!out.seconds) delete out.seconds
  ;(Object.keys(out) as (keyof ParagraphInfo)[]).forEach((k) => out[k] === undefined && delete out[k])
  return Object.keys(out).length ? out : undefined
}

export function ParagraphFields({
  value,
  onChange,
  topicId,
  myAnswer
}: {
  value: ParagraphInfo | undefined
  onChange: (v: ParagraphInfo) => void
  topicId?: string
  myAnswer?: string
}): React.JSX.Element {
  const p = value ?? {}
  const [time, setTime] = useState(p.seconds ? fmtSeconds(p.seconds).replace(' sn', '') : '')
  const fromTopic = topicQType(topicId)
  const set = (patch: Partial<ParagraphInfo>): void => onChange({ ...p, ...patch })
  const between = p.between ?? []

  return (
    <div className="rounded-xl border border-border bg-surface-2/50 p-3.5">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold text-text">Paragraf / anlam sorusu</span>
        <span className="text-[11px] text-subtle">Hepsi isteğe bağlı · boş bırakılanı AI bulur</span>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_120px]">
        <label className="block">
          <span className="label">Soru tipi</span>
          <Select
            value={p.qType && !p.qTypeAuto ? p.qType : ''}
            onChange={(e) => set({ qType: (e.target.value || undefined) as ParaQType | undefined, qTypeAuto: undefined })}
          >
            <option value="">
              {fromTopic ? `Konudan: ${QTYPE_LABEL[fromTopic]}` : p.qType ? `AI: ${QTYPE_LABEL[p.qType]}` : 'AI belirlesin'}
            </option>
            {(Object.keys(QTYPE_LABEL) as ParaQType[]).map((q) => (
              <option key={q} value={q}>
                {QTYPE_LABEL[q]}
              </option>
            ))}
          </Select>
        </label>
        <label className="block">
          <span className="label">Süre</span>
          <Input
            value={time}
            onChange={(e) => {
              setTime(e.target.value)
              set({ seconds: parseSeconds(e.target.value) })
            }}
            placeholder="ör. 1:40"
          />
        </label>
      </div>
      <div className="mt-3">
        <span className="label">Arada kaldığım şıklar</span>
        <div className="flex items-center gap-1">
          {LETTERS.map((l) => {
            const on = between.includes(l)
            return (
              <button
                key={l}
                type="button"
                onClick={() => set({ between: on ? between.filter((x) => x !== l) : [...between, l].sort() })}
                className={cn(
                  'h-8 w-8 rounded-lg border text-xs font-semibold transition-colors',
                  on ? 'border-accent bg-accent/15 text-accent' : 'border-border bg-surface text-muted hover:text-text',
                  myAnswer === l && !on && 'border-danger/50'
                )}
                title={myAnswer === l ? 'İşaretlediğin şık' : undefined}
              >
                {l}
              </button>
            )
          })}
          {between.length === 1 && <span className="ml-2 text-[11px] text-subtle">bir şık daha seç</span>}
        </div>
      </div>
      <label className="mt-3 block">
        <span className="label">Neden o şıkkı seçtim?</span>
        <Textarea
          rows={2}
          value={p.why ?? ''}
          onChange={(e) => set({ why: e.target.value })}
          placeholder="ör. Metnin sonunda geçiyordu, ana düşünce sandım"
        />
      </label>
    </div>
  )
}
