import { useMemo, useState } from 'react'
import { Button, Field, Input, NumberInput } from '@/components/ui'
import { SubjectSelect, TopicSelect } from '@/components/study/SubjectSelect'
import { SUBJECT_MAP } from '@/data/curriculum'
import { todayKey } from '@/lib/date'
import { DEFAULT_SUBJECT, fmtDur, fmtNum, netOf, paragrafTopicId } from './lib'

export interface PracticeValues {
  date: string
  subjectId: string
  topicId?: string
  count: number
  seconds: number
  correct: number
  wrong: number
  blank: number
  source?: string
  note?: string
}

interface FormState {
  date: string
  subjectId: string
  topicId?: string
  count: number
  min: number
  sec: number
  correct: number
  wrong: number
  blank: number
  blankTouched: boolean
  source: string
  note: string
}

export function initialValues(last?: { subjectId?: string; topicId?: string; source?: string }): FormState {
  const subjectId = last?.subjectId && SUBJECT_MAP[last.subjectId] ? last.subjectId : DEFAULT_SUBJECT
  const topicId = last?.subjectId ? last.topicId : paragrafTopicId()
  return {
    date: todayKey(),
    subjectId,
    topicId,
    count: 0,
    min: 0,
    sec: 0,
    correct: 0,
    wrong: 0,
    blank: 0,
    blankTouched: false,
    source: last?.source ?? '',
    note: ''
  }
}

export function fromPractice(p: PracticeValues): FormState {
  return {
    date: p.date,
    subjectId: p.subjectId,
    topicId: p.topicId,
    count: p.count,
    min: Math.floor(p.seconds / 60),
    sec: p.seconds % 60,
    correct: p.correct,
    wrong: p.wrong,
    blank: p.blank,
    blankTouched: true,
    source: p.source ?? '',
    note: p.note ?? ''
  }
}

export function PracticeForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  inline = false
}: {
  initial: FormState
  submitLabel: string
  onSubmit: (v: PracticeValues) => void
  onCancel?: () => void
  /** Sayfa üstündeki hızlı giriş düzeni (daha geniş, tek satırlı alanlar) */
  inline?: boolean
}): React.JSX.Element {
  const [f, setF] = useState<FormState>(initial)
  const set = (p: Partial<FormState>): void => setF((x) => ({ ...x, ...p }))

  const seconds = f.min * 60 + f.sec
  const autoBlank = Math.max(0, f.count - f.correct - f.wrong)
  const blank = f.blankTouched ? f.blank : autoBlank
  const sum = f.correct + f.wrong + blank

  const error = useMemo(() => {
    if (f.count <= 0) return 'Soru sayısı gir'
    if (seconds <= 0) return 'Süre gir'
    if (sum !== f.count) return `D + Y + B (${sum}) soru sayısına (${f.count}) eşit olmalı`
    return null
  }, [f.count, seconds, sum])

  const preview =
    f.count > 0 && seconds > 0
      ? `≈ ${fmtDur(seconds / f.count)} / soru · %${fmtNum((f.correct / f.count) * 100, 0)} doğru · net ${fmtNum(netOf(f.correct, f.wrong), 2)}`
      : 'Soru sayısı ve süreyi girince özet burada görünür'

  const submit = (): void => {
    if (error) return
    onSubmit({
      date: f.date,
      subjectId: f.subjectId,
      topicId: f.topicId,
      count: f.count,
      seconds,
      correct: f.correct,
      wrong: f.wrong,
      blank,
      source: f.source.trim() || undefined,
      note: f.note.trim() || undefined
    })
  }

  const numCls = 'w-full'
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      className="space-y-4"
    >
      <div className={inline ? 'grid grid-cols-2 gap-3 lg:grid-cols-12' : 'grid grid-cols-2 gap-3'}>
        <Field label="Ders" className={inline ? 'col-span-1 lg:col-span-3' : 'col-span-1'}>
          <SubjectSelect
            value={f.subjectId}
            onChange={(v) => set({ subjectId: v ?? DEFAULT_SUBJECT, topicId: undefined })}
            placeholder="Ders"
          />
        </Field>
        <Field label="Konu" className={inline ? 'col-span-1 lg:col-span-5' : 'col-span-1'}>
          <TopicSelect subjectId={f.subjectId} value={f.topicId} onChange={(v) => set({ topicId: v })} />
        </Field>
        <Field label="Tarih" className={inline ? 'col-span-1 lg:col-span-2' : 'col-span-1'}>
          <Input type="date" value={f.date} max={todayKey()} onChange={(e) => set({ date: e.target.value || todayKey() })} />
        </Field>
        <Field label="Kaynak" className={inline ? 'col-span-1 lg:col-span-2' : 'col-span-1'}>
          <Input value={f.source} placeholder="ör. Limit Paragraf" onChange={(e) => set({ source: e.target.value })} />
        </Field>
      </div>

      <div className={inline ? 'grid grid-cols-3 gap-3 sm:grid-cols-6 lg:grid-cols-12' : 'grid grid-cols-3 gap-3'}>
        <Field label="Soru" className={inline ? 'lg:col-span-2' : ''}>
          <NumberInput className={numCls} value={f.count} onChange={(v) => set({ count: v })} />
        </Field>
        <Field label="Süre (dk)" className={inline ? 'lg:col-span-2' : ''}>
          <NumberInput className={numCls} value={f.min} onChange={(v) => set({ min: v })} />
        </Field>
        <Field label="Süre (sn)" className={inline ? 'lg:col-span-2' : ''}>
          <NumberInput className={numCls} value={f.sec} max={59} onChange={(v) => set({ sec: v })} />
        </Field>
        <Field label="Doğru" className={inline ? 'lg:col-span-2' : ''}>
          <NumberInput className={numCls} value={f.correct} onChange={(v) => set({ correct: v })} />
        </Field>
        <Field label="Yanlış" className={inline ? 'lg:col-span-2' : ''}>
          <NumberInput className={numCls} value={f.wrong} onChange={(v) => set({ wrong: v })} />
        </Field>
        <Field label="Boş" className={inline ? 'lg:col-span-2' : ''}>
          <NumberInput className={numCls} value={blank} onChange={(v) => set({ blank: v, blankTouched: true })} />
        </Field>
      </div>

      <Field label="Not">
        <Input value={f.note} placeholder="İsteğe bağlı" onChange={(e) => set({ note: e.target.value })} />
      </Field>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <div className="min-w-0 text-sm">
          <span className="tabular text-muted">{preview}</span>
          {error && f.count > 0 && seconds > 0 && <span className="ml-3 text-xs text-danger">{error}</span>}
        </div>
        <div className="flex gap-2">
          {onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Vazgeç
            </Button>
          )}
          <Button type="submit" variant="primary" disabled={!!error}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  )
}
