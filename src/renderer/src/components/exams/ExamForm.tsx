import { AlertTriangle, Check, ChevronRight, Minus, Plus, Search, Trash2 } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import type { ExamMistake, ExamResult, ExamType, Field, MistakeKind, Subject, SubjectScore } from '../../../../shared/types'
import { Badge, Button, Dot, Field as FormField, Input, Modal, Segmented, Select, Textarea, cn, NumberInput, toast } from '@/components/ui'
import { sectionsFor, subjectsFor } from '@/data/curriculum'
import { todayKey } from '@/lib/date'
import { FIELD_LABEL, MISTAKE_KIND_COLOR, MISTAKE_KIND_LABEL, fmtNet, round2 } from '@/lib/exam'
import { useStore } from '@/lib/store'
import { mid } from './helpers'

interface Row {
  c?: number
  w?: number
  b?: number
  /** Kullanıcı boşu elle değiştirdi mi (otomatik hesap devre dışı) */
  bTouched?: boolean
}

type FieldSel = Field | 'ALL'
const KINDS = Object.keys(MISTAKE_KIND_LABEL) as MistakeKind[]

const hasData = (r: Row | undefined): boolean =>
  !!r && ((r.c ?? 0) + (r.w ?? 0) > 0 || (!!r.bTouched && (r.b ?? 0) > 0))
const rowNet = (r: Row | undefined): number => (r ? (r.c ?? 0) - (r.w ?? 0) / 4 : 0)

function autoBlank(r: Row, qc: number): Row {
  if (r.bTouched) return r
  if (r.c === undefined && r.w === undefined) return { ...r, b: undefined }
  return { ...r, b: Math.max(0, qc - (r.c ?? 0) - (r.w ?? 0)) }
}

function initRows(exam: ExamResult | undefined): Record<string, Row> {
  const out: Record<string, Row> = {}
  if (!exam) return out
  for (const [id, s] of Object.entries(exam.scores)) {
    out[id] = { c: s.correct, w: s.wrong, b: s.blank, bTouched: true }
  }
  return out
}

/** Sayı hücresi — boş bırakılabilir, Enter bir sonrakine geçer */
function Cell({
  value,
  onChange,
  max,
  invalid,
  placeholder,
  tone,
  label
}: {
  value: number | undefined
  onChange: (v: number | undefined) => void
  max: number
  invalid?: boolean
  placeholder?: string
  tone?: 'success' | 'danger' | 'muted'
  label: string
}): React.JSX.Element {
  return (
    <input
      type="number"
      inputMode="numeric"
      data-cell
      aria-label={label}
      min={0}
      max={max}
      placeholder={placeholder ?? '–'}
      value={value ?? ''}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => {
        if (e.target.value === '') return onChange(undefined)
        const n = Math.floor(Number(e.target.value))
        onChange(Number.isNaN(n) ? undefined : Math.max(0, Math.min(max, n)))
      }}
      className={cn(
        'input tabular h-9 px-1 text-center font-medium',
        tone === 'success' && !!value && 'text-success',
        tone === 'danger' && !!value && 'text-danger',
        invalid && 'border-danger bg-danger/10 text-danger focus:border-danger focus:ring-danger/25'
      )}
    />
  )
}

export default function ExamForm({
  exam,
  defaultType,
  onClose,
  onSaved
}: {
  exam?: ExamResult
  defaultType: ExamType
  onClose: () => void
  onSaved: (e: ExamResult) => void
}): React.JSX.Element {
  const settings = useStore((s) => s.data.settings)
  const exams = useStore((s) => s.data.exams)
  const addExam = useStore((s) => s.addExam)
  const updateExam = useStore((s) => s.updateExam)

  const [type, setType] = useState<ExamType>(exam?.type ?? defaultType)
  const [name, setName] = useState(exam?.name ?? '')
  const [date, setDate] = useState(exam?.date ?? todayKey())
  const [duration, setDuration] = useState<number | undefined>(exam?.durationMin)
  const [note, setNote] = useState(exam?.note ?? '')
  const [rows, setRows] = useState<Record<string, Row>>(() => initRows(exam))
  const [mistakes, setMistakes] = useState<ExamMistake[]>(exam?.mistakes ?? [])
  const [step, setStep] = useState<1 | 2>(1)
  const [field, setField] = useState<FieldSel>(() => {
    const defField: FieldSel = settings.field === 'DIL' ? 'ALL' : settings.field
    if (exam?.type === 'AYT') {
      const allowed = new Set(subjectsFor('AYT', defField).map((s) => s.id))
      return Object.keys(exam.scores).every((id) => allowed.has(id)) ? defField : 'ALL'
    }
    return defField
  })
  const formRef = useRef<HTMLDivElement>(null)

  const sections = useMemo(() => sectionsFor(type, type === 'AYT' ? field : undefined), [type, field])
  const visible = useMemo(() => sections.flatMap((s) => s.subjects), [sections])

  const nameSuggestions = useMemo(() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const e of exams.slice().sort((a, b) => b.date.localeCompare(a.date))) {
      if (e.type === type && e.name && !seen.has(e.name)) {
        seen.add(e.name)
        out.push(e.name)
      }
    }
    return out
  }, [exams, type])

  /* ---------- puan satırları ---------- */
  const setRow = (s: Subject, patch: Partial<Row>): void =>
    setRows((prev) => {
      const cur = prev[s.id] ?? {}
      let next: Row = { ...cur, ...patch }
      if ('b' in patch) {
        next.bTouched = patch.b !== undefined
      }
      next = autoBlank(next, s.questionCount)
      return { ...prev, [s.id]: next }
    })

  const stats = useMemo(() => {
    let c = 0
    let w = 0
    let b = 0
    let n = 0
    let invalid = 0
    let used = 0
    const secNet: Record<string, number> = {}
    for (const sec of sections) {
      let sn = 0
      for (const s of sec.subjects) {
        const r = rows[s.id]
        if (r && (r.c ?? 0) + (r.w ?? 0) + (r.b ?? 0) > s.questionCount) invalid++
        if (!hasData(r)) continue
        used++
        c += r?.c ?? 0
        w += r?.w ?? 0
        b += r?.b ?? 0
        sn += rowNet(r)
      }
      secNet[sec.name] = round2(sn)
      n += sn
    }
    return { c, w, b, net: round2(n), invalid, used, secNet }
  }, [rows, sections])

  /* ---------- Enter ile sonraki hücre ---------- */
  const onKeyDown = (e: React.KeyboardEvent): void => {
    const t = e.target as HTMLElement
    if (e.key !== 'Enter' || !t.hasAttribute('data-cell')) return
    e.preventDefault()
    const cells = Array.from(formRef.current?.querySelectorAll<HTMLInputElement>('input[data-cell]') ?? [])
    const i = cells.indexOf(t as HTMLInputElement)
    cells[i + 1]?.focus()
  }

  /* ---------- hata analizi ---------- */
  const mistakeSubjects = visible.filter((s) => {
    const r = rows[s.id]
    return hasData(r) && (r?.w ?? 0) + (r?.b ?? 0) > 0
  })
  const totalToDistribute = mistakeSubjects.reduce((a, s) => a + (rows[s.id]?.w ?? 0) + (rows[s.id]?.b ?? 0), 0)
  const totalDistributed = mistakeSubjects.reduce(
    (a, s) => a + mistakes.filter((m) => m.subjectId === s.id).reduce((x, m) => x + m.count, 0),
    0
  )

  const addMistake = (subjectId: string, topicId: string, kind: MistakeKind): void =>
    setMistakes((prev) => {
      const ex = prev.find((m) => m.subjectId === subjectId && m.topicId === topicId && m.kind === kind)
      if (ex) return prev.map((m) => (m === ex ? { ...m, count: m.count + 1 } : m))
      return [...prev, { id: mid(), subjectId, topicId, count: 1, kind }]
    })
  const patchMistake = (id: string, patch: Partial<ExamMistake>): void =>
    setMistakes((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)))
  const removeMistake = (id: string): void => setMistakes((prev) => prev.filter((m) => m.id !== id))

  /* ---------- kaydet ---------- */
  const canSave = stats.used > 0 && stats.invalid === 0 && !!date

  const save = (): void => {
    if (!canSave) return
    const scores: Record<string, SubjectScore> = {}
    for (const s of visible) {
      const r = rows[s.id]
      if (!hasData(r)) continue
      scores[s.id] = { correct: r?.c ?? 0, wrong: r?.w ?? 0, blank: r?.b ?? 0 }
    }
    const cleanMistakes = mistakes.filter((m) => scores[m.subjectId] && m.count > 0)
    const payload = {
      type,
      name: name.trim() || `${type} Denemesi`,
      date,
      durationMin: duration && duration > 0 ? duration : undefined,
      scores,
      mistakes: cleanMistakes,
      note: note.trim() || undefined
    }
    if (exam) {
      updateExam(exam.id, payload)
      toast('Deneme güncellendi')
      onSaved({ ...exam, ...payload })
    } else {
      const created = addExam(payload)
      toast('Deneme kaydedildi')
      onSaved(created)
    }
  }

  const changeType = (t: ExamType): void => {
    if (t === type) return
    setType(t)
    setRows({})
    setMistakes([])
  }

  return (
    <Modal
      open
      onClose={onClose}
      width={960}
      title={exam ? 'Denemeyi düzenle' : 'Deneme ekle'}
      subtitle="Ders sonuçlarını gir; Boş sayısı otomatik hesaplanır. İstersen yanlış/boş konu analizini de ekle."
      footer={
        <>
          {stats.invalid > 0 && (
            <span className="mr-auto inline-flex items-center gap-1.5 text-xs font-medium text-danger">
              <AlertTriangle size={14} /> {stats.invalid} derste D + Y + B soru sayısını aşıyor
            </span>
          )}
          {stats.invalid === 0 && stats.used === 0 && (
            <span className="mr-auto text-xs text-subtle">Kaydetmek için en az bir derse sonuç gir.</span>
          )}
          <Button variant="ghost" onClick={onClose}>
            Vazgeç
          </Button>
          {step === 1 ? (
            <Button variant="outline" onClick={() => setStep(2)} disabled={stats.used === 0}>
              Konu analizi <ChevronRight size={14} />
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setStep(1)}>
              Sonuçlara dön
            </Button>
          )}
          <Button variant="primary" icon={<Check size={15} />} onClick={save} disabled={!canSave}>
            {exam ? 'Güncelle' : 'Kaydet'}
          </Button>
        </>
      }
    >
      {/* Sabit özet şeridi */}
      <div className="sticky top-0 z-10 -mx-5 -mt-4 mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-5 py-3">
        <div className="flex items-center gap-1.5">
          <StepButton active={step === 1} n={1} onClick={() => setStep(1)}>
            Sonuçlar
          </StepButton>
          <ChevronRight size={14} className="text-subtle" />
          <StepButton active={step === 2} n={2} onClick={() => setStep(2)} disabled={stats.used === 0}>
            Yanlış / boş konu analizi
            {totalToDistribute > 0 && (
              <span className="tabular ml-1 rounded bg-surface-3 px-1 text-[10px] text-muted">
                {totalDistributed}/{totalToDistribute}
              </span>
            )}
          </StepButton>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 text-xs text-muted">
            <span>
              D <b className="tabular text-success">{stats.c}</b>
            </span>
            <span>
              Y <b className="tabular text-danger">{stats.w}</b>
            </span>
            <span>
              B <b className="tabular text-text">{stats.b}</b>
            </span>
          </div>
          <div className="flex items-baseline gap-1.5 rounded-lg bg-accent/10 px-3 py-1">
            <span className="text-[11px] font-medium text-accent">Toplam net</span>
            <span className="tabular text-xl font-semibold text-text">{fmtNet(stats.net)}</span>
          </div>
        </div>
      </div>

      {step === 1 ? (
        <div className="space-y-5" ref={formRef} onKeyDown={onKeyDown}>
          {/* Üst bilgiler */}
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-12 sm:col-span-3">
              <span className="label">Sınav türü</span>
              <Segmented
                value={type}
                onChange={changeType}
                options={[
                  { value: 'TYT', label: 'TYT' },
                  { value: 'AYT', label: 'AYT' }
                ]}
                className={cn(exam && 'pointer-events-none opacity-60')}
              />
            </div>
            <FormField label="Yayın / deneme adı" className="col-span-12 sm:col-span-5">
              <Input
                list="exam-name-list"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={type === 'TYT' ? 'ör. Bilgi Sarmal TYT-3' : 'ör. 345 AYT-2'}
                autoFocus={!exam}
              />
              <datalist id="exam-name-list">
                {nameSuggestions.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </FormField>
            <FormField label="Tarih" className="col-span-7 sm:col-span-2">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} max="2099-12-31" />
            </FormField>
            <FormField label="Süre (dk)" className="col-span-5 sm:col-span-2">
              <NumberInput
                value={duration}
                onChange={(v) => setDuration(v > 0 ? v : undefined)}
                max={400}
                placeholder={type === 'TYT' ? '135' : '180'}
              />
            </FormField>
          </div>

          {type === 'AYT' && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface-2/60 px-3 py-2">
              <span className="text-xs font-medium text-muted">Gösterilen dersler</span>
              <Segmented<FieldSel>
                size="sm"
                value={field}
                onChange={setField}
                options={[
                  { value: 'SAY', label: FIELD_LABEL.SAY },
                  { value: 'EA', label: FIELD_LABEL.EA },
                  { value: 'SOZ', label: FIELD_LABEL.SOZ },
                  { value: 'ALL', label: 'Tüm AYT dersleri' }
                ]}
              />
              <span className="text-[11px] text-subtle">Sadece sonuç girdiğin dersler kaydedilir.</span>
            </div>
          )}

          {/* Ders satırları */}
          <div className="space-y-4">
            {sections.map((sec) => (
              <div key={sec.name} className="overflow-hidden rounded-xl border border-border">
                <div className="flex items-center justify-between bg-surface-2 px-3.5 py-2">
                  <div className="text-xs font-semibold text-text">
                    {sec.name} <span className="ml-1 font-normal text-subtle">{sec.questionCount} soru</span>
                  </div>
                  <div className="text-xs text-muted">
                    Bölüm neti <b className="tabular ml-1 text-sm text-text">{fmtNet(stats.secNet[sec.name] ?? 0)}</b>
                  </div>
                </div>
                <div className="divide-y divide-border/70">
                  <div className="grid grid-cols-[minmax(0,1fr)_44px_72px_72px_72px_64px] items-center gap-2 px-3.5 pt-2 text-[10px] font-medium uppercase tracking-wide text-subtle">
                    <span>Ders</span>
                    <span className="text-center">Soru</span>
                    <span className="text-center">Doğru</span>
                    <span className="text-center">Yanlış</span>
                    <span className="text-center">Boş</span>
                    <span className="text-right">Net</span>
                  </div>
                  {sec.subjects.map((s) => {
                    const r = rows[s.id]
                    const sum = (r?.c ?? 0) + (r?.w ?? 0) + (r?.b ?? 0)
                    const over = sum > s.questionCount
                    const n = rowNet(r)
                    return (
                      <div
                        key={s.id}
                        className={cn(
                          'grid grid-cols-[minmax(0,1fr)_44px_72px_72px_72px_64px] items-center gap-2 px-3.5 py-1.5 transition-colors',
                          over && 'bg-danger/5'
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
                          <Dot color={s.color} />
                          <span className="truncate">{s.name}</span>
                        </div>
                        <span className="tabular text-center text-xs text-muted">{s.questionCount}</span>
                        <Cell
                          label={`${s.name} doğru`}
                          value={r?.c}
                          max={s.questionCount}
                          invalid={over}
                          tone="success"
                          onChange={(v) => setRow(s, { c: v })}
                        />
                        <Cell
                          label={`${s.name} yanlış`}
                          value={r?.w}
                          max={s.questionCount}
                          invalid={over}
                          tone="danger"
                          onChange={(v) => setRow(s, { w: v })}
                        />
                        <Cell
                          label={`${s.name} boş`}
                          value={r?.b}
                          max={s.questionCount}
                          invalid={over}
                          onChange={(v) => setRow(s, { b: v })}
                        />
                        <span
                          className={cn(
                            'tabular text-right text-sm font-semibold',
                            over ? 'text-danger' : hasData(r) ? (n >= 0 ? 'text-text' : 'text-danger') : 'text-subtle'
                          )}
                          title={over ? 'D + Y + B soru sayısını aşıyor' : undefined}
                        >
                          {hasData(r) ? fmtNet(round2(n)) : '–'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          <FormField label="Notlar" hint="Deneme hakkında kısa not: süre yönetimi, ruh hali, genel gözlemler…">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="İsteğe bağlı" />
          </FormField>
        </div>
      ) : (
        <MistakeStep
          subjects={mistakeSubjects}
          rows={rows}
          mistakes={mistakes}
          onAdd={addMistake}
          onPatch={patchMistake}
          onRemove={removeMistake}
        />
      )}
    </Modal>
  )
}

function StepButton({
  n,
  active,
  onClick,
  disabled,
  children
}: {
  n: number
  active: boolean
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex h-8 items-center gap-2 rounded-lg px-2.5 text-sm font-medium transition-colors disabled:opacity-40',
        active ? 'bg-surface-2 text-text ring-1 ring-border' : 'text-muted hover:text-text'
      )}
    >
      <span
        className={cn(
          'grid h-5 w-5 place-items-center rounded-full text-[11px]',
          active ? 'bg-accent text-on-accent' : 'bg-surface-3 text-muted'
        )}
      >
        {n}
      </span>
      {children}
    </button>
  )
}

/* ====================== Hata analizi adımı ====================== */

function MistakeStep({
  subjects,
  rows,
  mistakes,
  onAdd,
  onPatch,
  onRemove
}: {
  subjects: Subject[]
  rows: Record<string, Row>
  mistakes: ExamMistake[]
  onAdd: (subjectId: string, topicId: string, kind: MistakeKind) => void
  onPatch: (id: string, patch: Partial<ExamMistake>) => void
  onRemove: (id: string) => void
}): React.JSX.Element {
  if (!subjects.length) {
    return (
      <div className="grid place-items-center gap-1 py-14 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-success/10 text-success">
          <Check size={22} />
        </div>
        <div className="text-sm font-semibold">Analiz edilecek yanlış veya boş yok</div>
        <p className="max-w-sm text-xs text-muted">Sonuçlar adımında yanlış ya da boş bırakılan sorular olduğunda burada konu bazlı analiz girebilirsin.</p>
      </div>
    )
  }
  return (
    <div className="space-y-4">
      <p className="text-xs leading-relaxed text-muted">
        Hangi konulardan yanlış veya boş bıraktığını işaretle. Bu bilgi <b className="text-text">zayıf konu analizini</b> besler. Bir konuya
        tıklamak sayıyı 1 artırır. Tamamını girmek zorunda değilsin.
      </p>
      {subjects.map((s) => (
        <SubjectMistakes
          key={s.id}
          subject={s}
          wrong={rows[s.id]?.w ?? 0}
          blank={rows[s.id]?.b ?? 0}
          items={mistakes.filter((m) => m.subjectId === s.id)}
          onAdd={onAdd}
          onPatch={onPatch}
          onRemove={onRemove}
        />
      ))}
    </div>
  )
}

function SubjectMistakes({
  subject,
  wrong,
  blank,
  items,
  onAdd,
  onPatch,
  onRemove
}: {
  subject: Subject
  wrong: number
  blank: number
  items: ExamMistake[]
  onAdd: (subjectId: string, topicId: string, kind: MistakeKind) => void
  onPatch: (id: string, patch: Partial<ExamMistake>) => void
  onRemove: (id: string) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<MistakeKind>(wrong > 0 ? 'bilgi' : 'bos')
  const distributed = items.reduce((a, m) => a + m.count, 0)
  const total = wrong + blank
  const over = distributed > total
  const done = distributed === total

  const topicMap = useMemo(() => new Map(subject.topics.map((t) => [t.id, t])), [subject])

  const groups = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr-TR')
    const out: { group: string; topics: typeof subject.topics }[] = []
    for (const t of subject.topics) {
      if (q && !t.name.toLocaleLowerCase('tr-TR').includes(q) && !(t.group ?? '').toLocaleLowerCase('tr-TR').includes(q)) continue
      const g = t.group ?? ''
      let bucket = out.find((x) => x.group === g)
      if (!bucket) {
        bucket = { group: g, topics: [] }
        out.push(bucket)
      }
      bucket.topics.push(t)
    }
    return out
  }, [subject, query])

  const countFor = (topicId: string): number => items.filter((m) => m.topicId === topicId).reduce((a, m) => a + m.count, 0)

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-surface-2 px-3.5 py-2.5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Dot color={subject.color} /> {subject.name}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className={cn('tabular', over ? 'text-warning' : done ? 'text-success' : 'text-muted')}>
            {wrong} yanlış + {blank} boş, <b>{distributed}</b> tanesi konulara dağıtıldı
          </span>
          {done && <Check size={14} className="text-success" />}
          {over && <AlertTriangle size={14} className="text-warning" />}
        </div>
      </div>

      <div className="space-y-2 p-3">
        {items.map((m) => {
          const t = topicMap.get(m.topicId)
          return (
            <div
              key={m.id}
              className="grid grid-cols-[minmax(0,1.3fr)_auto_150px_minmax(0,1fr)_28px] items-center gap-2 rounded-lg bg-surface-2/60 px-2.5 py-1.5"
            >
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium">{t?.name ?? 'Bilinmeyen konu'}</div>
                {t?.group && <div className="truncate text-[10px] text-subtle">{t.group}</div>}
              </div>
              <div className="inline-flex items-center rounded-lg border border-border bg-surface">
                <button
                  type="button"
                  className="grid h-8 w-7 place-items-center text-muted hover:text-text"
                  onClick={() => (m.count <= 1 ? onRemove(m.id) : onPatch(m.id, { count: m.count - 1 }))}
                  aria-label="Azalt"
                >
                  <Minus size={13} />
                </button>
                <span className="tabular w-6 text-center text-sm font-semibold">{m.count}</span>
                <button
                  type="button"
                  className="grid h-8 w-7 place-items-center text-muted hover:text-text"
                  onClick={() => onPatch(m.id, { count: m.count + 1 })}
                  aria-label="Artır"
                >
                  <Plus size={13} />
                </button>
              </div>
              <Select
                value={m.kind}
                onChange={(e) => onPatch(m.id, { kind: e.target.value as MistakeKind })}
                className="h-8 text-xs"
                style={{ color: MISTAKE_KIND_COLOR[m.kind] }}
              >
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {MISTAKE_KIND_LABEL[k]}
                  </option>
                ))}
              </Select>
              <Input
                value={m.note ?? ''}
                onChange={(e) => onPatch(m.id, { note: e.target.value || undefined })}
                placeholder="Not (isteğe bağlı)"
                className="h-8 text-xs"
              />
              <button
                type="button"
                onClick={() => onRemove(m.id)}
                className="grid h-7 w-7 place-items-center rounded-md text-subtle hover:bg-danger/10 hover:text-danger"
                aria-label="Kaldır"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )
        })}

        {!open ? (
          <Button size="sm" variant="outline" icon={<Plus size={14} />} onClick={() => setOpen(true)}>
            Konu ekle
          </Button>
        ) : (
          <div className="rounded-lg border border-accent/30 bg-accent/5 p-2.5">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <div className="relative min-w-[200px] flex-1">
                <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-subtle" />
                <Input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`${subject.name} konusu ara…`}
                  className="h-8 pl-8 text-xs"
                />
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {KINDS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    className={cn(
                      'rounded-md border px-2 py-1 text-[11px] font-medium transition-colors',
                      kind === k ? 'border-transparent' : 'border-border text-muted hover:text-text'
                    )}
                    style={kind === k ? { background: MISTAKE_KIND_COLOR[k] + '26', color: MISTAKE_KIND_COLOR[k] } : undefined}
                  >
                    {MISTAKE_KIND_LABEL[k]}
                  </button>
                ))}
              </div>
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
                Bitti
              </Button>
            </div>
            <div className="max-h-56 space-y-2.5 overflow-y-auto pr-1">
              {groups.length === 0 && <div className="py-4 text-center text-xs text-muted">Eşleşen konu yok.</div>}
              {groups.map((g) => (
                <div key={g.group || '_'}>
                  {g.group && <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-subtle">{g.group}</div>}
                  <div className="flex flex-wrap gap-1.5">
                    {g.topics.map((t) => {
                      const c = countFor(t.id)
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => onAdd(subject.id, t.id, kind)}
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors',
                            c > 0
                              ? 'border-accent/40 bg-accent/10 text-text'
                              : 'border-border bg-surface text-muted hover:border-accent/40 hover:text-text'
                          )}
                        >
                          {t.name}
                          {c > 0 && <Badge className="tabular !px-1 !py-0">{c}</Badge>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
