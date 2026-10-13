import { useCallback, useMemo, useState } from 'react'
import { AlertTriangle, CalendarPlus, ClipboardList, Layers, Plus, Play, Search, Target, X } from 'lucide-react'
import type { MistakeNote } from '../../../shared/types'
import { Button, Card, EmptyState, Input, PageHeader, Segmented, Select, StatCard, cn, confirm, toast } from '@/components/ui'
import { SUBJECTS, SUBJECT_MAP, TOPIC_MAP } from '@/data/curriculum'
import { MISTAKE_KIND_COLOR, MISTAKE_KIND_LABEL } from '@/lib/exam'
import { startOfWeek, todayKey } from '@/lib/date'
import { useNav } from '@/lib/nav'
import { useStore } from '@/lib/store'
import { fold } from '@/components/topics/meta'
import { KINDS, MistakeModal, type MistakeDraft } from '@/components/mistakes/MistakeModal'
import { MistakeCard } from '@/components/mistakes/MistakeCard'
import { ReviewMode } from '@/components/mistakes/ReviewMode'

type StatusFilter = 'all' | 'open' | 'done'

export default function Mistakes(): React.JSX.Element {
  const notes = useStore((s) => s.data.mistakeNotes)
  const update = useStore((s) => s.updateMistakeNote)
  const remove = useStore((s) => s.deleteMistakeNote)

  const params = useNav.getState().params
  const [modal, setModal] = useState<{ note?: MistakeNote; draft?: MistakeDraft } | null>(() =>
    params.new
      ? {
          draft: {
            subjectId: typeof params.subject === 'string' ? params.subject : undefined,
            topicId: typeof params.topic === 'string' ? params.topic : undefined
          }
        }
      : null
  )
  const [reviewIds, setReviewIds] = useState<string[] | null>(null)
  const [subjectFilter, setSubjectFilter] = useState('all')
  const [kindFilter, setKindFilter] = useState('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')

  const openNotes = useMemo(() => notes.filter((n) => !n.resolved), [notes])

  const stats = useMemo(() => {
    const weekStart = startOfWeek(todayKey())
    const thisWeek = notes.filter((n) => n.date >= weekStart).length
    const bySubject = new Map<string, number>()
    const byTopic = new Map<string, number>()
    for (const n of notes) {
      bySubject.set(n.subjectId, (bySubject.get(n.subjectId) ?? 0) + 1)
      if (n.topicId) byTopic.set(n.topicId, (byTopic.get(n.topicId) ?? 0) + 1)
    }
    const top = (m: Map<string, number>): [string, number] | undefined =>
      [...m.entries()].sort((a, b) => b[1] - a[1])[0]
    return { thisWeek, topSubject: top(bySubject), topTopic: top(byTopic) }
  }, [notes])

  const subjectsWithNotes = useMemo(() => {
    const ids = new Set(notes.map((n) => n.subjectId))
    return SUBJECTS.filter((s) => ids.has(s.id))
  }, [notes])

  const filtered = useMemo(() => {
    const q = fold(search.trim())
    return notes
      .filter((n) => {
        if (subjectFilter !== 'all' && n.subjectId !== subjectFilter) return false
        if (kindFilter !== 'all' && n.kind !== kindFilter) return false
        if (status === 'open' && n.resolved) return false
        if (status === 'done' && !n.resolved) return false
        if (q) {
          const hay = fold(
            [n.text, n.lesson, n.source, SUBJECT_MAP[n.subjectId]?.name, n.topicId ? TOPIC_MAP[n.topicId]?.name : '']
              .filter(Boolean)
              .join(' ')
          )
          if (!hay.includes(q)) return false
        }
        return true
      })
      .sort((a, b) => Number(a.resolved) - Number(b.resolved) || b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  }, [notes, subjectFilter, kindFilter, status, search])

  const filtering = subjectFilter !== 'all' || kindFilter !== 'all' || status !== 'all' || search.trim() !== ''

  const onToggle = useCallback(
    (n: MistakeNote) => {
      update(n.id, { resolved: !n.resolved })
      toast(n.resolved ? 'Not yeniden açıldı' : 'Çözüldü olarak işaretlendi', 'info')
    },
    [update]
  )
  const onEdit = useCallback((n: MistakeNote) => setModal({ note: n }), [])
  const onDelete = useCallback(
    async (n: MistakeNote) => {
      if (await confirm({ title: 'Bu not silinsin mi?', message: 'Hata defterinden kalıcı olarak silinecek.' })) {
        remove(n.id)
        toast('Not silindi', 'info')
      }
    },
    [remove]
  )

  const newBtn = (
    <Button variant="primary" icon={<Plus size={15} />} onClick={() => setModal({})}>
      Yeni hata notu
    </Button>
  )

  const topSubject = stats.topSubject ? SUBJECT_MAP[stats.topSubject[0]] : undefined
  const topTopic = stats.topTopic ? TOPIC_MAP[stats.topTopic[0]] : undefined

  return (
    <div>
      <PageHeader
        title="Hata Defteri"
        description="Yanlış yaptığın soruları ve çıkardığın dersleri biriktir, sınavdan önce tekrar et."
        actions={
          <>
            <Button
              variant="outline"
              icon={<Play size={14} />}
              disabled={openNotes.length === 0}
              onClick={() => setReviewIds(openNotes.map((n) => n.id))}
            >
              Tekrar modu
              {openNotes.length > 0 && (
                <span className="tabular rounded bg-accent/15 px-1.5 text-[11px] font-semibold text-accent">
                  {openNotes.length}
                </span>
              )}
            </Button>
            {newBtn}
          </>
        }
      />

      {notes.length === 0 ? (
        <Card>
          <EmptyState
            className="py-20"
            icon={<ClipboardList size={22} />}
            title="Hata defterin henüz boş"
            description="Denemede ya da soru çözerken yanlış yaptığın soruları buraya not al. Doğrusunu yazdığın notları daha sonra flashcard gibi tekrar edebilirsin."
            action={newBtn}
          />
        </Card>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatCard label="Toplam not" value={notes.length} icon={<Layers size={14} />} sub={`${notes.length - openNotes.length} tanesi çözüldü`} />
            <StatCard
              label="Açık hata"
              value={openNotes.length}
              icon={<AlertTriangle size={14} />}
              accent="rgb(var(--warning))"
              sub={notes.length ? `%${Math.round((openNotes.length / notes.length) * 100)} hâlâ açık` : undefined}
            />
            <StatCard
              label="Bu hafta eklenen"
              value={stats.thisWeek}
              icon={<CalendarPlus size={14} />}
              accent="rgb(var(--info))"
              sub="Pazartesiden itibaren"
            />
            <StatCard
              label="En çok hata"
              value={<span className="block truncate text-lg leading-8">{topSubject?.name ?? '—'}</span>}
              icon={<Target size={14} />}
              accent={topSubject?.color ?? 'rgb(var(--danger))'}
              sub={
                <span className="block truncate">
                  {stats.topSubject && `${stats.topSubject[1]} not`}
                  {topTopic && stats.topTopic && ` · ${topTopic.name} (${stats.topTopic[1]})`}
                </span>
              }
            />
          </div>

          <div className="mb-5 flex flex-wrap items-center gap-2">
            <div className="relative w-64">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Notlarda ara…"
                className="pl-8 pr-8"
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
            <Select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} className="!w-48" aria-label="Ders">
              <option value="all">Tüm dersler</option>
              {subjectsWithNotes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
                        <Segmented<StatusFilter>
              value={status}
              onChange={setStatus}
              options={[
                { value: 'all', label: 'Tümü' },
                { value: 'open', label: 'Açık' },
                { value: 'done', label: 'Çözüldü' }
              ]}
            />
            {filtering && (
              <Button
                variant="ghost"
                size="sm"
                icon={<X size={13} />}
                onClick={() => {
                  setSearch('')
                  setSubjectFilter('all')
                  setKindFilter('all')
                  setStatus('all')
                }}
              >
                Temizle
              </Button>
            )}
            <span className="tabular ml-auto text-xs text-muted">{filtered.length} not</span>
          </div>

          {/* tür dağılımı */}
          <div className="mb-4 flex flex-wrap items-center gap-1.5">
            {KINDS.map((k) => {
              const c = MISTAKE_KIND_COLOR[k]
              const count = notes.filter((n) => n.kind === k).length
              const active = kindFilter === k
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKindFilter(active ? 'all' : k)}
                  className={cn(
                    'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium transition-colors',
                    !active && 'border-border text-muted hover:text-text'
                  )}
                  style={active ? { borderColor: c, background: c + '1f', color: c } : undefined}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
                  {MISTAKE_KIND_LABEL[k]}
                  <span className="tabular opacity-70">{count}</span>
                </button>
              )
            })}
          </div>

          {filtered.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Search size={20} />}
                title="Bu süzgece uyan not yok"
                description="Arama ya da süzgeçleri değiştirmeyi dene."
              />
            </Card>
          ) : (
            <div className="columns-1 gap-4 lg:columns-2 2xl:columns-3">
              {filtered.map((n) => (
                <MistakeCard key={n.id} note={n} onToggle={onToggle} onEdit={onEdit} onDelete={(x) => void onDelete(x)} />
              ))}
            </div>
          )}
        </>
      )}

      {modal && <MistakeModal note={modal.note} draft={modal.draft} onClose={() => setModal(null)} />}
      {reviewIds && <ReviewMode ids={reviewIds} onClose={() => setReviewIds(null)} />}
    </div>
  )
}
