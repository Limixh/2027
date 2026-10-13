import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, Info, Layers, RotateCcw, Search, X } from 'lucide-react'
import type { Field, Subject, Topic, TopicStatus } from '../../../shared/types'
import {
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  ProgressBar,
  ProgressRing,
  Segmented,
  Select,
  Textarea,
  cn,
  confirm,
  toast
} from '@/components/ui'
import { CURRICULUM_NOTE, SUBJECTS, TOTAL_TOPICS, subjectsFor } from '@/data/curriculum'
import { useStore } from '@/lib/store'
import { useNav } from '@/lib/nav'
import { overallProgress, reviewsDue, solvedByTopic, subjectProgress } from '@/lib/stats'
import { FIELD_LABEL } from '@/lib/exam'
import { fold, STATUS_META, type Tier } from '@/components/topics/meta'
import { TopicRow } from '@/components/topics/TopicRow'
import { SubjectSection } from '@/components/topics/SubjectSection'

type ExamTab = 'TYT' | 'AYT'
type FieldFilter = Field | 'ALL'

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [w, setW] = useState(1000)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setW(el.getBoundingClientRect().width)
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

export default function Topics(): React.JSX.Element {
  const data = useStore((s) => s.data)
  const setTopicProgress = useStore((s) => s.setTopicProgress)
  const markReviewed = useStore((s) => s.markReviewed)
  const settingsField = data.settings.field

  const initial = useNav.getState().params
  const initSubject = typeof initial.subject === 'string' ? SUBJECTS.find((s) => s.id === initial.subject) : undefined

  const [exam, setExam] = useState<ExamTab>(
    initSubject ? initSubject.exam : initial.exam === 'AYT' ? 'AYT' : 'TYT'
  )
  const [field, setField] = useState<FieldFilter>(settingsField === 'DIL' ? 'ALL' : settingsField)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | `${TopicStatus}`>('all')
  const [dueOnly, setDueOnly] = useState(false)
  const [selected, setSelected] = useState<string>(initSubject?.id ?? '')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [noteFor, setNoteFor] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [paneRef, paneW] = useWidth<HTMLDivElement>()
  const searchRef = useRef<HTMLInputElement>(null)

  const tier: Tier = paneW >= 960 ? 'wide' : paneW >= 700 ? 'mid' : 'narrow'

  const subjects = useMemo(() => subjectsFor(exam, exam === 'AYT' ? field : undefined), [exam, field])
  const effectiveSelected =
    selected === 'all' || subjects.some((s) => s.id === selected) ? selected : (subjects[0]?.id ?? 'all')

  // "/" ile aramaya odaklan
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const progressMap = data.topicProgress
  const solvedMap = useMemo(() => solvedByTopic(data.sessions), [data.sessions])
  const due = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of reviewsDue(data)) m.set(r.topicId, r.overdue)
    return m
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.topicProgress])
  const mistakeMap = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of data.exams) for (const x of e.mistakes) m.set(x.topicId, (m.get(x.topicId) ?? 0) + x.count)
    return m
  }, [data.exams])

  const overall = useMemo(
    () => ({ tyt: overallProgress(data, 'TYT'), ayt: overallProgress(data, 'AYT'), all: overallProgress(data) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.topicProgress]
  )
  const statusCounts = useMemo(() => {
    const c = [0, 0, 0, 0, 0]
    for (const s of SUBJECTS) for (const t of s.topics) c[progressMap[t.id]?.status ?? 0]++
    return c
  }, [progressMap])
  const subjectCounts = useMemo(() => {
    const m = new Map<string, number[]>()
    for (const s of SUBJECTS) {
      const c = [0, 0, 0, 0, 0]
      for (const t of s.topics) c[progressMap[t.id]?.status ?? 0]++
      m.set(s.id, c)
    }
    return m
  }, [progressMap])

  const q = fold(search.trim())
  const filtering = q !== '' || statusFilter !== 'all' || dueOnly

  const filtered = useMemo(() => {
    const m = new Map<string, Topic[]>()
    for (const s of subjects) {
      const sName = fold(s.name)
      const list = s.topics.filter((t) => {
        if (q && !(fold(t.name).includes(q) || (t.group && fold(t.group).includes(q)) || sName.includes(q))) return false
        const st = progressMap[t.id]?.status ?? 0
        if (statusFilter !== 'all' && st !== Number(statusFilter)) return false
        if (dueOnly && !due.has(t.id)) return false
        return true
      })
      m.set(s.id, list)
    }
    return m
  }, [subjects, q, statusFilter, dueOnly, progressMap, due])

  const dueInScope = useMemo(
    () => subjects.reduce((n, s) => n + s.topics.filter((t) => due.has(t.id)).length, 0),
    [subjects, due]
  )

  const viewAll = effectiveSelected === 'all' || q !== ''
  const visibleSubjects: Subject[] = viewAll
    ? subjects.filter((s) => (filtered.get(s.id)?.length ?? 0) > 0 || (!filtering && effectiveSelected === 'all'))
    : subjects.filter((s) => s.id === effectiveSelected)

  /* ---- eylemler ---- */
  const onStatus = useCallback(
    (id: string, status: TopicStatus) => setTopicProgress(id, { status }),
    [setTopicProgress]
  )
  const onConfidence = useCallback(
    (id: string, v: number | undefined) => setTopicProgress(id, { confidence: v }),
    [setTopicProgress]
  )
  const onReview = useCallback(
    (id: string) => {
      markReviewed(id)
      toast('Tekrar kaydedildi', 'success')
    },
    [markReviewed]
  )
  const onNote = useCallback((id: string) => {
    setNoteFor(id)
    setNoteText(useStore.getState().data.topicProgress[id]?.note ?? '')
  }, [])

  const bulk = async (subject: Subject, topics: Topic[], status: TopicStatus): Promise<void> => {
    const label = STATUS_META[status].label
    const ok = await confirm({
      title: status === 0 ? 'Konular sıfırlansın mı?' : `Tüm konular “${label}” yapılsın mı?`,
      message: `${subject.name} dersindeki ${topics.length} konunun durumu “${label}” olarak ayarlanacak.`,
      confirmText: 'Uygula',
      danger: status === 0
    })
    if (!ok) return
    for (const t of topics) setTopicProgress(t.id, { status })
    toast(`${topics.length} konu güncellendi`)
  }

  const noteTopic = noteFor ? SUBJECTS.flatMap((s) => s.topics).find((t) => t.id === noteFor) : undefined

  const renderRow =
    (): ((t: Topic) => React.ReactNode) =>
    (t) => (
      <TopicRow
        key={t.id}
        topic={t}
        tier={tier}
        progress={progressMap[t.id]}
        solved={solvedMap.get(t.id)}
        mistakes={mistakeMap.get(t.id) ?? 0}
        overdue={due.get(t.id)}
        onStatus={onStatus}
        onConfidence={onConfidence}
        onReview={onReview}
        onNote={onNote}
      />
    )
  const rowRenderer = renderRow()

  const clearFilters = (): void => {
    setSearch('')
    setStatusFilter('all')
    setDueOnly(false)
  }

  const matchTotal = visibleSubjects.reduce((n, s) => n + (filtered.get(s.id)?.length ?? 0), 0)

  return (
    <div>
      <PageHeader
        title="Konu Takibi"
        description={`${TOTAL_TOPICS} konu · durumunu işaretle, tekrarlarını kaçırma`}
        actions={
          <Segmented<ExamTab>
            value={exam}
            onChange={(v) => {
              setExam(v)
              setSelected('')
            }}
            options={[
              { value: 'TYT', label: 'TYT' },
              { value: 'AYT', label: 'AYT' }
            ]}
          />
        }
      />

      {/* ---- Genel ilerleme ---- */}
      <div className="mb-3 grid grid-cols-12 gap-4">
        <Card className="col-span-12 flex flex-wrap items-center justify-around gap-x-6 gap-y-4 p-5 lg:col-span-7">
          {(
            [
              { key: 'tyt', label: 'TYT', p: overall.tyt },
              { key: 'ayt', label: 'AYT', p: overall.ayt },
              { key: 'all', label: 'Genel', p: overall.all }
            ] as const
          ).map(({ key, label, p }) => (
            <div key={key} className="flex items-center gap-4">
              <ProgressRing value={p.pct} size={key === 'all' ? 88 : 72} stroke={key === 'all' ? 9 : 8}>
                <span className="tabular text-sm font-semibold">%{Math.round(p.pct * 100)}</span>
              </ProgressRing>
              <div>
                <div className="text-xs font-medium text-muted">{label}</div>
                <div className="tabular mt-0.5 text-lg font-semibold leading-none">
                  {p.done}
                  <span className="text-sm font-normal text-subtle"> / {p.total}</span>
                </div>
                <div className="mt-1 text-[11px] text-subtle">konu bitti veya ötesi</div>
              </div>
            </div>
          ))}
        </Card>

        <Card className="col-span-12 flex flex-col justify-center gap-3 p-5 lg:col-span-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted">Durum dağılımı</span>
            <span className="tabular text-[11px] text-subtle">{TOTAL_TOPICS} konu</span>
          </div>
          <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-3">
            {statusCounts.map((c, i) => (
              <div
                key={i}
                className="h-full transition-[width] duration-500"
                style={{ width: `${(c / TOTAL_TOPICS) * 100}%`, background: STATUS_META[i].color, opacity: i === 0 ? 0.25 : 1 }}
              />
            ))}
          </div>
          <div className="grid grid-cols-5 gap-1">
            {STATUS_META.map((m) => {
              const active = statusFilter === `${m.value}`
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setStatusFilter(active ? 'all' : `${m.value}`)}
                  title={`${m.label} konularını süz`}
                  className={cn(
                    'rounded-lg border px-1.5 py-1.5 text-left transition-colors',
                    active ? 'border-accent bg-accent/10' : 'border-transparent bg-surface-2 hover:bg-surface-3'
                  )}
                >
                  <div className="tabular text-base font-semibold leading-none" style={{ color: m.value === 0 ? undefined : m.color }}>
                    {statusCounts[m.value]}
                  </div>
                  <div className="mt-1 break-words text-[10.5px] leading-tight text-muted">{m.label}</div>
                </button>
              )
            })}
          </div>
        </Card>
      </div>

      <div className="mb-4 flex items-start gap-2 rounded-xl border border-info/25 bg-info/5 px-3.5 py-2 text-xs leading-relaxed text-muted">
        <Info size={14} className="mt-px shrink-0 text-info" />
        <span>{CURRICULUM_NOTE}</span>
      </div>

      {/* ---- Filtreler ---- */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {exam === 'AYT' && (
          <Select
            value={field}
            onChange={(e) => {
              setField(e.target.value as FieldFilter)
              setSelected('')
            }}
            className="!w-44"
            aria-label="Alan"
          >
            <option value="ALL">Tüm AYT dersleri</option>
            <option value="SAY">{FIELD_LABEL.SAY}</option>
            <option value="EA">{FIELD_LABEL.EA}</option>
            <option value="SOZ">{FIELD_LABEL.SOZ}</option>
          </Select>
        )}
        <div className="relative w-64">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
          <Input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Konu ara…  ( / )"
            className="pl-8 pr-8"
            onKeyDown={(e) => e.key === 'Escape' && (setSearch(''), e.currentTarget.blur())}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-subtle hover:text-text"
              aria-label="Aramayı temizle"
            >
              <X size={13} />
            </button>
          )}
        </div>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="!w-40"
          aria-label="Durum"
        >
          <option value="all">Tüm durumlar</option>
          {STATUS_META.map((m) => (
            <option key={m.value} value={`${m.value}`}>
              {m.label}
            </option>
          ))}
        </Select>
        <button
          type="button"
          onClick={() => setDueOnly((v) => !v)}
          className={cn(
            'inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors',
            dueOnly
              ? 'border-warning/50 bg-warning/10 text-warning'
              : 'border-border bg-surface-2 text-muted hover:text-text'
          )}
        >
          <RotateCcw size={14} />
          Tekrarı gelenler
          <span
            className={cn(
              'tabular rounded px-1.5 py-px text-[11px] font-semibold',
              dueInScope > 0 ? 'bg-warning/20 text-warning' : 'bg-surface-3 text-subtle'
            )}
          >
            {dueInScope}
          </span>
        </button>
        {filtering && (
          <Button variant="ghost" size="sm" icon={<X size={13} />} onClick={clearFilters}>
            Süzgeçleri temizle
          </Button>
        )}
        <div className="ml-auto hidden text-[11px] text-subtle 2xl:block">
          Satır seçiliyken: <kbd className="rounded border border-border bg-surface-2 px-1">0–4</kbd> durum ·{' '}
          <kbd className="rounded border border-border bg-surface-2 px-1">↑↓</kbd> gezin ·{' '}
          <kbd className="rounded border border-border bg-surface-2 px-1">R</kbd> tekrar ·{' '}
          <kbd className="rounded border border-border bg-surface-2 px-1">N</kbd> not
        </div>
      </div>

      {exam === 'AYT' && settingsField === 'DIL' && field === 'ALL' && (
        <div className="mb-4 rounded-xl border border-border bg-surface-2/60 px-3.5 py-2 text-xs text-muted">
          Dil alanı için AYT’de ayrı bir konu listesi bulunmuyor (YDT yabancı dil sınavıdır); bu yüzden tüm AYT dersleri
          gösteriliyor.
        </div>
      )}

      {/* ---- Ders listesi + konular ---- */}
      <div className="grid grid-cols-12 items-start gap-5">
        <aside className="sticky top-14 col-span-3 hidden max-h-[calc(100vh-4.5rem)] overflow-y-auto pb-4 pr-1 xl:block">
          <div className="space-y-1.5">
            <SubjectNavItem
              active={effectiveSelected === 'all' && q === ''}
              onClick={() => setSelected('all')}
              icon={<Layers size={15} />}
              name="Tüm dersler"
              sub={`${subjects.length} ders`}
              pct={
                subjects.length
                  ? subjects.reduce((a, s) => a + subjectProgress(data, s).pct, 0) / subjects.length
                  : 0
              }
              color="rgb(var(--accent))"
            />
            {subjects.map((s) => {
              const p = subjectProgress(data, s)
              return (
                <SubjectNavItem
                  key={s.id}
                  active={effectiveSelected === s.id && q === ''}
                  onClick={() => {
                    setSearch('')
                    setSelected(s.id)
                  }}
                  name={s.name}
                  sub={`${p.done}/${p.total}`}
                  pct={p.pct}
                  color={s.color}
                  match={filtering ? (filtered.get(s.id)?.length ?? 0) : undefined}
                />
              )
            })}
          </div>
        </aside>

        {/* dar ekran: yatay ders seçici */}
        <div className="col-span-12 -mt-1 flex gap-1.5 overflow-x-auto pb-1 xl:hidden">
          <ChipButton active={effectiveSelected === 'all'} onClick={() => setSelected('all')}>
            Tümü
          </ChipButton>
          {subjects.map((s) => (
            <ChipButton
              key={s.id}
              active={effectiveSelected === s.id}
              onClick={() => {
                setSearch('')
                setSelected(s.id)
              }}
              color={s.color}
            >
              {s.name}
            </ChipButton>
          ))}
        </div>

        <div ref={paneRef} className="col-span-12 min-w-0 space-y-4 xl:col-span-9">
          {q !== '' && (
            <div className="text-xs text-muted">
              “{search.trim()}” için tüm derslerde <span className="tabular font-semibold text-text">{matchTotal}</span> konu
              bulundu.
            </div>
          )}
          {subjects.length === 0 && (
            <Card>
              <EmptyState icon={<BookOpen size={20} />} title="Gösterilecek ders yok" />
            </Card>
          )}
          {subjects.length > 0 && visibleSubjects.length === 0 && (
            <Card>
              <EmptyState
                icon={<Search size={20} />}
                title="Eşleşen konu yok"
                description="Arama veya durum süzgeçlerini değiştirip tekrar dene."
                action={
                  <Button variant="secondary" onClick={clearFilters}>
                    Süzgeçleri temizle
                  </Button>
                }
              />
            </Card>
          )}
          {visibleSubjects.map((s) => {
            const topics = filtered.get(s.id) ?? []
            const p = subjectProgress(data, s)
            return (
              <SubjectSection
                key={s.id}
                subject={s}
                topics={topics}
                counts={subjectCounts.get(s.id) ?? [0, 0, 0, 0, 0]}
                done={p.done}
                total={p.total}
                collapsible={viewAll}
                collapsed={viewAll && collapsed.has(s.id)}
                onToggle={() =>
                  setCollapsed((prev) => {
                    const n = new Set(prev)
                    if (n.has(s.id)) n.delete(s.id)
                    else n.add(s.id)
                    return n
                  })
                }
                onBulk={(status) => void bulk(s, topics, status)}
                renderRow={rowRenderer}
              />
            )
          })}
        </div>
      </div>

      <Modal
        open={noteFor !== null}
        onClose={() => setNoteFor(null)}
        title="Konu notu"
        subtitle={noteTopic?.name}
        width={480}
        footer={
          <>
            {noteFor && data.topicProgress[noteFor]?.note && (
              <Button
                variant="ghost"
                className="mr-auto"
                onClick={() => {
                  setTopicProgress(noteFor, { note: undefined })
                  setNoteFor(null)
                }}
              >
                Notu sil
              </Button>
            )}
            <Button variant="ghost" onClick={() => setNoteFor(null)}>
              Vazgeç
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (noteFor) setTopicProgress(noteFor, { note: noteText.trim() || undefined })
                setNoteFor(null)
              }}
            >
              Kaydet
            </Button>
          </>
        }
      >
        <Textarea
          autoFocus
          rows={6}
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Formül, ipucu, kaynak, eksik kaldığın yerler…"
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && noteFor) {
              setTopicProgress(noteFor, { note: noteText.trim() || undefined })
              setNoteFor(null)
            }
          }}
        />
      </Modal>
    </div>
  )
}

function SubjectNavItem({
  active,
  onClick,
  name,
  sub,
  pct,
  color,
  icon,
  match
}: {
  active: boolean
  onClick: () => void
  name: string
  sub: string
  pct: number
  color: string
  icon?: React.ReactNode
  match?: number
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group w-full rounded-xl border px-3 py-2 text-left transition-all',
        active ? 'border-accent/50 bg-accent/10 shadow-sm' : 'border-border bg-surface hover:bg-surface-2'
      )}
    >
      <div className="flex items-center gap-2">
        {icon ? (
          <span className="text-accent">{icon}</span>
        ) : (
          <span className="h-3.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
        )}
        <span className={cn('min-w-0 flex-1 truncate text-[13px] font-medium', active ? 'text-text' : 'text-text/90')}>
          {name}
        </span>
        {match !== undefined && (
          <span
            className={cn(
              'tabular rounded px-1.5 text-[10px] font-semibold',
              match > 0 ? 'bg-accent/15 text-accent' : 'bg-surface-3 text-subtle'
            )}
          >
            {match}
          </span>
        )}
        <span className="tabular shrink-0 text-[11px] text-muted">{sub}</span>
      </div>
      <ProgressBar value={pct} color={color} height={4} className="mt-1.5" />
    </button>
  )
}

function ChipButton({
  active,
  onClick,
  children,
  color
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  color?: string
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-xs font-medium transition-colors',
        active ? 'border-accent/50 bg-accent/10 text-text' : 'border-border bg-surface text-muted hover:text-text'
      )}
    >
      {color && <span className="h-2 w-2 rounded-full" style={{ background: color }} />}
      {children}
    </button>
  )
}
