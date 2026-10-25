// Kitaplarım: soru bankaları. PDF'li kitaptan sayfa + soru numarasıyla soru alınır; PDF'siz (basılı) kitaplar
// da eklenir ve soru eklerken seçilir. Her kitap için hangi konularda, hangi sayfalarda takıldığın görülür.
import { useMemo, useState } from 'react'
import { BarChart3, BookOpen, BookPlus, FileText, FileUp, Library, Pencil, ScanSearch, Trash2 } from 'lucide-react'
import type { Book } from '../../../shared/types'
import { Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, cn, confirm, toast } from '@/components/ui'
import { SUBJECTS, SUBJECT_MAP } from '@/data/curriculum'
import { bookStats, bookSummaries } from '@/lib/bookStats'
import { formatDate } from '@/lib/date'
import { useStore } from '@/lib/store'
import { QuestionPicker } from '@/components/books/QuestionPicker'
import { BookStatsModal } from '@/components/books/BookStatsModal'

const fold = (s: string): string =>
  s
    .toLocaleLowerCase('tr')
    .replace(/[çğıöşü]/g, (c) => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' })[c] ?? c)

/** Dosya adından okunur başlık: "@Kanal 345 TYT MATEMATIK SORU BANKASI.pdf" → "345 TYT MATEMATIK SORU BANKASI" */
const titleFrom = (file: string): string =>
  file
    .replace(/\.pdf$/i, '')
    .replace(/^@\S+\s*/, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'Kitap'

/** Dosya adından ders tahmini (TYT/AYT + ders adı geçiyorsa) */
function guessSubject(file: string): string | undefined {
  const f = fold(file)
  const exam = /\bayt\b/.test(f) ? 'AYT' : /\btyt\b/.test(f) ? 'TYT' : undefined
  // Ders adının ayırt edici kelimeleri ("Temel Matematik" → "matematik")
  const hits = SUBJECTS.filter(
    (s) =>
      (!exam || s.exam === exam) &&
      fold(s.name)
        .split(/\s+/)
        .some((w) => w.length >= 5 && w !== 'temel' && f.includes(w))
  )
  return hits.length ? hits[0].id : undefined
}

const mb = (n: number): string => `${(n / 1024 / 1024).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} MB`

type Pdf = { rel: string; fileName: string; size: number }

/**
 * Kitap ekle / düzenle. Kitap tek bir şeydir; PDF'i isteğe bağlıdır (eklenirse sayfa + soru numarasıyla
 * soru alınır). Var olan kitaba sonradan da PDF eklenebilir.
 */
function BookForm({ book, onClose }: { book?: Book; onClose: () => void }): React.JSX.Element {
  const update = useStore((s) => s.updateBook)
  const add = useStore((s) => s.addBook)
  const [title, setTitle] = useState(book?.title ?? '')
  const [publisher, setPublisher] = useState(book?.publisher ?? '')
  const [subjectId, setSubjectId] = useState(book?.subjectId ?? '')
  const [offset, setOffset] = useState(String(book?.pageOffset ?? 0))
  // Bu formda yeni seçilen PDF (kaydedilmeden kapatılırsa kopyası silinir)
  const [pdf, setPdf] = useState<Pdf | null>(null)
  const [copying, setCopying] = useState(false)
  const [tried, setTried] = useState(false)
  const desktop = !!window.api?.books
  const currentPdf = pdf ?? (book?.rel ? { rel: book.rel, fileName: book.fileName ?? 'PDF', size: book.size ?? 0 } : null)

  const pickPdf = async (): Promise<void> => {
    if (!window.api?.books) return
    setCopying(true)
    try {
      const [f, ...extra] = await window.api.books.import()
      for (const x of extra) void window.api.books.remove(x.rel) // tek kitap = tek PDF
      if (!f) return
      if (pdf) void window.api.books.remove(pdf.rel)
      setPdf(f)
      if (!title.trim()) setTitle(titleFrom(f.fileName))
      if (!subjectId) setSubjectId(guessSubject(f.fileName) ?? '')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'PDF eklenemedi', 'error')
    } finally {
      setCopying(false)
    }
  }

  const cancel = (): void => {
    if (pdf) void window.api?.books?.remove(pdf.rel)
    onClose()
  }

  const save = (): void => {
    setTried(true)
    if (!title.trim()) return
    const patch = {
      title: title.trim(),
      publisher: publisher.trim() || undefined,
      subjectId: subjectId || undefined,
      pageOffset: Number(offset) || 0,
      // Yeni PDF: eski sayfa taraması / düzeltmeleri geçersiz
      ...(pdf ? { rel: pdf.rel, fileName: pdf.fileName, size: pdf.size, insertedPages: undefined, pageMap: undefined, pages: undefined } : {})
    }
    if (book) {
      if (pdf && book.rel) void window.api?.books?.remove(book.rel)
      update(book.id, patch)
    } else {
      add(patch)
      toast('Kitap eklendi')
    }
    onClose()
  }
  return (
    <Modal
      open
      onClose={cancel}
      title={book ? 'Kitap bilgileri' : 'Kitap ekle'}
      subtitle="PDF isteğe bağlı: eklersen sayfa ve soru numarasıyla soruyu PDF’ten alırsın; eklemezsen soru eklerken kitabı seçersin. İkisinde de istatistikler tutulur."
      width={540}
      footer={
        <>
          <Button variant="ghost" onClick={cancel}>
            Vazgeç
          </Button>
          <Button variant="primary" disabled={copying} onClick={save}>
            {book ? 'Kaydet' : 'Ekle'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-xl border border-dashed border-border px-4 py-3">
          <FileText size={18} className={currentPdf ? 'text-accent' : 'text-subtle'} />
          <div className="min-w-0 flex-1 text-sm">
            {currentPdf ? (
              <>
                <div className="truncate">{currentPdf.fileName}</div>
                {currentPdf.size > 0 && <div className="text-[11px] text-subtle">{mb(currentPdf.size)} · uygulamanın klasörüne kopyalandı</div>}
              </>
            ) : (
              <span className="text-muted">PDF yok (basılı kitap)</span>
            )}
          </div>
          {desktop && (
            <Button variant="outline" size="sm" icon={<FileUp size={13} />} disabled={copying} onClick={() => void pickPdf()}>
              {copying ? 'Kopyalanıyor…' : currentPdf ? 'PDF’i değiştir' : 'PDF ekle (isteğe bağlı)'}
            </Button>
          )}
        </div>
        <Field label="Kitap adı">
          <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ör. Limit AYT Matematik Soru Bankası" />
          {tried && !title.trim() && <span className="mt-1 block text-[11px] text-danger">Kitabın adını yaz.</span>}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Yayınevi">
            <Input value={publisher} onChange={(e) => setPublisher(e.target.value)} placeholder="ör. 3-4-5, Limit, Bilgi Sarmal" />
          </Field>
          <Field label="Ders" hint="Bu kitaptan eklenen sorular bu derse girer">
            <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">— Seç —</option>
              {(['TYT', 'AYT'] as const).map((ex) => (
                <optgroup key={ex} label={ex}>
                  {SUBJECTS.filter((s) => s.exam === ex).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </Field>
        </div>
        {currentPdf && (
          <Field
            label="Sayfa kayması"
            hint="Çoğu kitapta 0'dır. Araya eklenmiş reklam sayfaları zaten otomatik atlanır; bu sayı yalnızca kitabın kendi sayfa numaralandırması kayıksa (ör. kapak numara almıyorsa) gerekir. Soru seçerken oklarla da düzeltebilirsin."
          >
            <Input type="number" value={offset} onChange={(e) => setOffset(e.target.value)} className="w-28" />
          </Field>
        )}
      </div>
    </Modal>
  )
}

export default function Books(): React.JSX.Element {
  const books = useStore((s) => s.data.books ?? [])
  const notes = useStore((s) => s.data.mistakeNotes)
  const deleteBook = useStore((s) => s.deleteBook)
  const [editing, setEditing] = useState<Book | 'new' | null>(null)
  const [stats, setStats] = useState<Book | null>(null)
  const [picker, setPicker] = useState(false)
  const desktop = !!window.api?.books
  const summaries = useMemo(() => bookSummaries(notes), [notes])
  const hasPdf = books.some((b) => b.rel)

  // En çok soru gelen kitaplar önce
  const sorted = useMemo(() => [...books].sort((a, b) => (summaries.get(b.id)?.total ?? 0) - (summaries.get(a.id)?.total ?? 0)), [books, summaries])
  const compare = useMemo(
    () =>
      sorted
        .filter((b) => summaries.get(b.id)?.total)
        .map((b) => {
          const st = bookStats(notes, b.id)
          return { b, st, top: st.topics.find((t) => !t.key.startsWith('ders:')) }
        }),
    [sorted, summaries, notes]
  )

  const addBtn = (
    <Button variant="primary" icon={<BookPlus size={15} />} onClick={() => setEditing('new')}>
      Kitap ekle
    </Button>
  )

  return (
    <div>
      <PageHeader
        title="Kitaplarım"
        description="Soru bankalarını ekle; PDF’i varsa onu da ekle (isteğe bağlı). PDF’li kitaptan sayfa ve soru numarasıyla soru otomatik kesilir; her kitabı soru eklerken seçersin ve hangi kitapta nerede takıldığını görürsün."
        actions={
          <>
            {hasPdf && (
              <Button variant="outline" icon={<ScanSearch size={15} />} onClick={() => setPicker(true)}>
                Kitaptan soru ekle
              </Button>
            )}
            {addBtn}
          </>
        }
      />

      {books.length === 0 ? (
        <Card>
          <EmptyState
            className="py-20"
            icon={<Library size={22} />}
            title="Henüz kitap yok"
            description="Kitabını adıyla ekle; PDF’i varsa onu da seç (ör. 345 TYT Matematik Soru Bankası). PDF uygulamanın kendi klasörüne kopyalanır, yalnızca bu bilgisayarda kalır."
            action={addBtn}
          />
        </Card>
      ) : (
        <>
          {compare.length > 1 && (
            <Card className="mb-5 overflow-hidden">
              <div className="border-b border-border px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-subtle">Kitap karşılaştırması</div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] text-subtle">
                    <th className="px-5 py-2 font-medium">Kitap</th>
                    <th className="px-3 py-2 text-right font-medium">Çözemediğim</th>
                    <th className="px-3 py-2 text-right font-medium">Açık</th>
                    <th className="px-3 py-2 text-right font-medium">Öğrenildi</th>
                    <th className="px-5 py-2 font-medium">En çok takıldığım konu</th>
                  </tr>
                </thead>
                <tbody>
                  {compare.map(({ b, st, top }) => (
                    <tr key={b.id} className="cursor-pointer border-t border-border transition-colors hover:bg-surface-2/60" onClick={() => setStats(b)}>
                      <td className="px-5 py-2.5">
                        <div className="max-w-[320px] truncate font-medium">{b.title}</div>
                        <div className="text-[11px] text-subtle">{[b.publisher, b.subjectId ? SUBJECT_MAP[b.subjectId]?.name : undefined].filter(Boolean).join(' · ')}</div>
                      </td>
                      <td className="tabular px-3 py-2.5 text-right">{st.total}</td>
                      <td className="tabular px-3 py-2.5 text-right">{st.open}</td>
                      <td className="tabular px-3 py-2.5 text-right">%{st.total ? Math.round((st.learned / st.total) * 100) : 0}</td>
                      <td className="px-5 py-2.5 text-muted">{top ? `${top.name} (${top.n})` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {sorted.map((b) => {
              const sum = summaries.get(b.id)
              const subject = b.subjectId ? SUBJECT_MAP[b.subjectId] : undefined
              return (
                <Card key={b.id} className="flex flex-col p-5">
                  <div className="flex items-start gap-3">
                    <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-lg', b.rel ? 'bg-accent/10 text-accent' : 'bg-surface-3 text-muted')}>
                      {b.rel ? <FileText size={18} /> : <BookOpen size={18} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 text-sm font-semibold leading-snug">{b.title}</div>
                      <div className="mt-1 text-xs text-muted">
                        {[b.publisher, subject ? `${subject.exam} ${subject.name}` : 'Ders seçilmedi', b.rel ? 'PDF' : 'Basılı'].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    {[
                      ['Çözemediğim', sum?.total ?? 0],
                      ['Açık', sum?.open ?? 0],
                      ['Öğrenildi', sum?.learned ?? 0]
                    ].map(([k, v]) => (
                      <div key={k as string} className="rounded-lg bg-surface-2 py-2">
                        <div className="tabular text-lg font-semibold">{v}</div>
                        <div className="text-[10px] text-subtle">{k}</div>
                      </div>
                    ))}
                  </div>

                  <div className="tabular mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-subtle">
                    {b.pages && <span>{b.pages} sayfa</span>}
                    {b.size && <span>{mb(b.size)}</span>}
                    {b.pageOffset !== 0 && b.rel && <span>kayma {b.pageOffset > 0 ? '+' : ''}{b.pageOffset}</span>}
                    {!!b.insertedPages?.length && <span title="Paylaşılan PDF'e sonradan eklenmiş reklam / kanal sayfaları; sayfa sayarken atlanır">{b.insertedPages.length} eklenmiş sayfa atlanıyor</span>}
                    <span>{formatDate(b.createdAt.slice(0, 10))}</span>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
                    <Button variant="outline" size="sm" icon={<BarChart3 size={13} />} onClick={() => setStats(b)}>
                      İstatistik
                    </Button>
                    {b.rel ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<ScanSearch size={13} />}
                        onClick={() => {
                          localStorage.setItem('yks-last-book', b.id)
                          setPicker(true)
                        }}
                      >
                        Soru al
                      </Button>
                    ) : (
                      desktop && (
                        <Button variant="ghost" size="sm" icon={<FileUp size={13} />} onClick={() => setEditing(b)} title="Bu kitabın PDF’i varsa ekle; sayfa ve soru numarasıyla soru alırsın">
                          PDF ekle
                        </Button>
                      )
                    )}
                    <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={() => setEditing(b)}>
                      Düzenle
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto text-danger hover:bg-danger/10"
                      icon={<Trash2 size={13} />}
                      aria-label="Sil"
                      onClick={async () => {
                        if (
                          await confirm({
                            title: 'Kitap silinsin mi?',
                            message: `“${b.title}” kitaplıktan${b.rel ? ` ve diskten (${mb(b.size ?? 0)})` : ''} silinir. Bu kitaptan Hata Defteri’ne eklediğin sorular kalır.`
                          })
                        ) {
                          deleteBook(b.id)
                          toast('Kitap silindi', 'info')
                        }
                      }}
                    />
                  </div>
                </Card>
              )
            })}
          </div>
        </>
      )}

      {editing && <BookForm book={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {stats && <BookStatsModal book={stats} onClose={() => setStats(null)} />}
      {picker && <QuestionPicker mode="multi" onClose={() => setPicker(false)} />}
    </div>
  )
}
