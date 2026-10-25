import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, ClipboardList, Inbox, Plus, Play, Search, Smartphone, X } from 'lucide-react'
import { QuestionPicker } from '@/components/books/QuestionPicker'
import type { MistakeNote } from '../../../shared/types'
import { Button, Card, EmptyState, Input, PageHeader, Segmented, Select, cn, confirm, toast } from '@/components/ui'
import { SUBJECTS, SUBJECT_MAP, TOPIC_MAP } from '@/data/curriculum'
import { MISTAKE_KIND_COLOR, MISTAKE_KIND_LABEL } from '@/lib/exam'
import { todayKey } from '@/lib/date'
import { useNav } from '@/lib/nav'
import { useStore } from '@/lib/store'
import { fold } from '@/components/topics/meta'
import { KINDS, MistakeModal, type MistakeDraft } from '@/components/mistakes/MistakeModal'
import { MistakeCard } from '@/components/mistakes/MistakeCard'
import { ReviewMode } from '@/components/mistakes/ReviewMode'
import { NoteDetail } from '@/components/mistakes/NoteDetail'
import { PhoneUploadModal } from '@/components/phone/PhoneUpload'
import { InboxWizard } from '@/components/mistakes/InboxWizard'
import { BatchAnalyze } from '@/components/mistakes/BatchAnalyze'

type StatusFilter = 'all' | 'open' | 'due' | 'done'

export default function Mistakes(): React.JSX.Element {
  const notes = useStore((s) => s.data.mistakeNotes)
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
  const [bookFilter, setBookFilter] = useState(typeof params.book === 'string' ? params.book : 'all')
  const books = useStore((s) => s.data.books)
  const booksWithNotes = useMemo(() => {
    const ids = new Set(notes.map((n) => n.bookRef?.bookId).filter(Boolean))
    return (books ?? []).filter((b) => ids.has(b.id))
  }, [books, notes])
  const [kindFilter, setKindFilter] = useState('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [phone, setPhone] = useState(false)
  const [wizard, setWizard] = useState(false)
  const [bookPicker, setBookPicker] = useState(false)
  const hasBooks = useStore((s) => !!s.data.books?.some((b) => b.rel))
  const closeWizard = useCallback(() => setWizard(false), [])

  const openNotes = useMemo(() => notes.filter((n) => !n.resolved), [notes])

  const today = todayKey()
  const dueNotes = useMemo(() => notes.filter((n) => !n.resolved && !!n.nextReview && n.nextReview <= today), [notes, today])
  const inboxCount = useMemo(() => notes.filter((n) => n.inbox).length, [notes])

  const subjectsWithNotes = useMemo(() => {
    const ids = new Set(notes.map((n) => n.subjectId))
    return SUBJECTS.filter((s) => ids.has(s.id))
  }, [notes])

  const filtered = useMemo(() => {
    const q = fold(search.trim())
    return notes
      .filter((n) => {
        if (subjectFilter !== 'all' && n.subjectId !== subjectFilter) return false
        if (bookFilter !== 'all' && n.bookRef?.bookId !== bookFilter) return false
        if (kindFilter !== 'all' && n.kind !== kindFilter) return false
        if (status === 'open' && n.resolved) return false
        if (status === 'due' && !(!n.resolved && n.nextReview && n.nextReview <= today)) return false
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
  }, [notes, subjectFilter, bookFilter, kindFilter, status, search, today])

  const filtering = subjectFilter !== 'all' || bookFilter !== 'all' || kindFilter !== 'all' || status !== 'all' || search.trim() !== ''

  // Listeye dönünce kaldığı yere kaydır
  const listScroll = useRef(0)
  const onOpen = useCallback((n: MistakeNote) => {
    listScroll.current = document.querySelector('main')?.scrollTop ?? 0
    setDetailId(n.id)
  }, [])
  const onEdit = useCallback((n: MistakeNote) => setModal({ note: n }), [])
  const onDelete = useCallback(
    async (n: MistakeNote) => {
      if (await confirm({ title: 'Bu not silinsin mi?', message: 'Hata defterinden kalıcı olarak silinecek.' })) {
        // Sayfadaysa silinen yerine sıradaki soruyu aç
        const i = filtered.findIndex((x) => x.id === n.id)
        const after = filtered[i + 1] ?? filtered[i - 1]
        remove(n.id)
        setDetailId((d) => (d === n.id ? (after?.id ?? null) : d))
        toast('Not silindi', 'info')
      }
    },
    [remove, filtered]
  )

  // Açık soru sayfası: süzülmüş listede önceki / sonraki
  const detailNav = useMemo(() => {
    const i = filtered.findIndex((n) => n.id === detailId)
    if (i < 0) return undefined
    return {
      position: i + 1,
      total: filtered.length,
      prev: i > 0 ? () => setDetailId(filtered[i - 1].id) : undefined,
      next: i < filtered.length - 1 ? () => setDetailId(filtered[i + 1].id) : undefined
    }
  }, [filtered, detailId])
  const closeDetail = useCallback(() => setDetailId(null), [])

  // Soru sayfası açılınca / soru değişince en üste, listeye dönünce eski yere kaydır
  useEffect(() => {
    const main = document.querySelector('main')
    if (detailId) main?.scrollTo({ top: 0 })
    else if (listScroll.current) {
      main?.scrollTo({ top: listScroll.current })
      listScroll.current = 0
    }
  }, [detailId])

  if (detailId && !reviewIds) {
    return (
      <div>
        <NoteDetail key={detailId} id={detailId} page nav={detailNav} onClose={closeDetail} onEdit={onEdit} onDelete={(x) => void onDelete(x)} />
        {modal && <MistakeModal note={modal.note} draft={modal.draft} onClose={() => setModal(null)} />}
      </div>
    )
  }

  const newBtn = (
    <Button variant="primary" icon={<Plus size={15} />} onClick={() => setModal({})}>
      Not ekle
    </Button>
  )

  return (
    <div>
      <PageHeader
        title="Hata Defteri"
        description="Yanlış yaptığın soruları ekle, AI ile analiz et, farklı günlerde tekrar çöz."
        actions={
          <>
            <BatchAnalyze />
            {hasBooks && (
              <Button variant="outline" icon={<BookOpen size={14} />} onClick={() => setBookPicker(true)} title="Kitaplarım’daki PDF’ten sayfa ve soru numarasıyla soru ekle">
                Kitaptan ekle
              </Button>
            )}
            {inboxCount > 0 && (
              <Button variant="outline" icon={<Inbox size={14} />} onClick={() => setWizard(true)} title="Telefondan gelen soruların bilgilerini sırayla gir">
                Toplu giriş
                <span className="tabular rounded bg-info/15 px-1.5 text-[11px] font-semibold text-info">{inboxCount}</span>
              </Button>
            )}
            <Button variant="outline" icon={<Smartphone size={14} />} onClick={() => setPhone(true)}>
              Telefondan yükle
            </Button>
            <Button
              variant="outline"
              icon={<Play size={14} />}
              disabled={openNotes.length === 0}
              onClick={() => setReviewIds((dueNotes.length ? dueNotes : openNotes).map((n) => n.id))}
            >
              Tekrar modu
              {openNotes.length > 0 && (
                <span className="tabular rounded bg-accent/15 px-1.5 text-[11px] font-semibold text-accent">
                  {dueNotes.length || openNotes.length}
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
            description="Yanlış yaptığın sorunun fotoğrafını ekle; konuyu seç, AI nerede takıldığını göstersin ve benzer sorularla pekiştirsin."
            action={newBtn}
          />
        </Card>
      ) : (
        <>
          <p className="mb-5 text-sm text-muted">
            <span className="tabular text-text">{notes.length}</span> not ·{' '}
            <span className="tabular text-text">{openNotes.length}</span> açık ·{' '}
            <span className={cn('tabular', dueNotes.length ? 'text-warning' : 'text-text')}>{dueNotes.length}</span> bugün tekrar
            {inboxCount > 0 && (
              <>
                {' '}
                ·{' '}
                <button type="button" className="hover:underline" onClick={() => setWizard(true)}>
                  <span className="tabular text-info">{inboxCount}</span> telefondan geldi
                </button>
              </>
            )}
          </p>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Segmented<StatusFilter>
              value={status}
              onChange={setStatus}
              options={[
                { value: 'all', label: 'Tümü' },
                { value: 'open', label: 'Açık' },
                { value: 'due', label: `Bugün tekrar${dueNotes.length ? ` (${dueNotes.length})` : ''}` },
                { value: 'done', label: 'Öğrenildi' }
              ]}
            />
            <div className="relative ml-auto w-56">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ara…" className="pl-8 pr-8" />
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
            <Select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} className="!w-44" aria-label="Ders">
              <option value="all">Tüm dersler</option>
              {subjectsWithNotes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            {booksWithNotes.length > 0 && (
              <Select value={bookFilter} onChange={(e) => setBookFilter(e.target.value)} className="!w-48" aria-label="Kitap">
                <option value="all">Tüm kitaplar</option>
                {booksWithNotes.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title}
                  </option>
                ))}
              </Select>
            )}
            {filtering && (
              <Button
                variant="ghost"
                size="sm"
                icon={<X size={13} />}
                onClick={() => {
                  setSearch('')
                  setSubjectFilter('all')
                  setBookFilter('all')
                  setKindFilter('all')
                  setStatus('all')
                }}
              >
                Temizle
              </Button>
            )}
          </div>

          <div className="mb-5 flex flex-wrap items-center gap-1.5">
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
            <span className="tabular ml-auto text-xs text-muted">{filtered.length} not</span>
          </div>

          {filtered.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Search size={20} />}
                title={status === 'due' ? 'Bugün tekrar edilecek not yok' : 'Bu süzgece uyan not yok'}
                description={status === 'due' ? 'Yeni eklenen sorular ertesi gün tekrar listene düşer.' : 'Arama ya da süzgeçleri değiştirmeyi dene.'}
              />
            </Card>
          ) : (
            <div className="columns-1 gap-4 lg:columns-2 2xl:columns-3">
              {filtered.map((n) => (
                <MistakeCard key={n.id} note={n} onOpen={onOpen} onEdit={onEdit} onDelete={(x) => void onDelete(x)} />
              ))}
            </div>
          )}
        </>
      )}

      {modal && <MistakeModal note={modal.note} draft={modal.draft} onClose={() => setModal(null)} />}
      {reviewIds && <ReviewMode ids={reviewIds} onClose={() => setReviewIds(null)} />}
      <PhoneUploadModal open={phone} onClose={() => setPhone(false)} />
      {wizard && <InboxWizard onClose={closeWizard} />}
      {bookPicker && <QuestionPicker mode="multi" onClose={() => setBookPicker(false)} />}
    </div>
  )
}
