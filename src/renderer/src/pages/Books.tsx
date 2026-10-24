// Kitaplarım: soru bankası PDF'leri. Eklenen kitaptan sayfa + soru numarasıyla soru alınır.
import { useState } from 'react'
import { BookOpen, FileUp, Library, Pencil, ScanSearch, Trash2 } from 'lucide-react'
import type { Book } from '../../../shared/types'
import { Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, confirm, toast } from '@/components/ui'
import { SUBJECTS, SUBJECT_MAP } from '@/data/curriculum'
import { formatDate } from '@/lib/date'
import { useStore } from '@/lib/store'
import { QuestionPicker } from '@/components/books/QuestionPicker'

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

function BookForm({ book, onClose }: { book: Book; onClose: () => void }): React.JSX.Element {
  const update = useStore((s) => s.updateBook)
  const [title, setTitle] = useState(book.title)
  const [publisher, setPublisher] = useState(book.publisher ?? '')
  const [subjectId, setSubjectId] = useState(book.subjectId ?? '')
  const [offset, setOffset] = useState(String(book.pageOffset))
  const save = (): void => {
    update(book.id, {
      title: title.trim() || book.title,
      publisher: publisher.trim() || undefined,
      subjectId: subjectId || undefined,
      pageOffset: Number(offset) || 0
    })
    onClose()
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="Kitap bilgileri"
      subtitle={book.fileName}
      width={520}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Vazgeç
          </Button>
          <Button variant="primary" onClick={save}>
            Kaydet
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Kitap adı">
          <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Yayınevi">
            <Input value={publisher} onChange={(e) => setPublisher(e.target.value)} placeholder="ör. 3-4-5, Limit, Bilgi Sarmal" />
          </Field>
          <Field label="Ders" hint="Bu kitaptan alınan sorular bu derse eklenir">
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
        <Field
          label="Sayfa kayması"
          hint="Çoğu kitapta 0'dır. Araya eklenmiş reklam sayfaları zaten otomatik atlanır; bu sayı yalnızca kitabın kendi sayfa numaralandırması kayıksa (ör. kapak numara almıyorsa) gerekir. Soru seçerken oklarla da düzeltebilirsin."
        >
          <Input type="number" value={offset} onChange={(e) => setOffset(e.target.value)} className="w-28" />
        </Field>
      </div>
    </Modal>
  )
}

export default function Books(): React.JSX.Element {
  const books = useStore((s) => s.data.books ?? [])
  const notes = useStore((s) => s.data.mistakeNotes)
  const addBook = useStore((s) => s.addBook)
  const deleteBook = useStore((s) => s.deleteBook)
  const [editing, setEditing] = useState<Book | null>(null)
  const [picker, setPicker] = useState(false)
  const [importing, setImporting] = useState(false)
  const desktop = !!window.api?.books

  const doImport = async (): Promise<void> => {
    if (!window.api?.books) return toast('Kitap ekleme yalnızca masaüstü uygulamasında çalışır', 'error')
    setImporting(true)
    try {
      const files = await window.api.books.import()
      const created = files.map((f) =>
        addBook({ title: titleFrom(f.fileName), subjectId: guessSubject(f.fileName), rel: f.rel, fileName: f.fileName, size: f.size, pageOffset: 0 })
      )
      if (created.length) {
        toast(created.length > 1 ? `${created.length} kitap eklendi` : 'Kitap eklendi')
        setEditing(created[0])
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Kitap eklenemedi', 'error')
    } finally {
      setImporting(false)
    }
  }

  const importBtn = (
    <Button variant="primary" icon={<FileUp size={15} />} disabled={importing} onClick={() => void doImport()}>
      {importing ? 'Kopyalanıyor…' : 'PDF ekle'}
    </Button>
  )

  return (
    <div>
      <PageHeader
        title="Kitaplarım"
        description="Soru bankası PDF’lerini ekle; sayfa ve soru numarasını yazınca soru otomatik bulunup kesilir — fotoğraf çekmene gerek kalmaz."
        actions={
          <>
            {books.length > 0 && (
              <Button variant="outline" icon={<ScanSearch size={15} />} onClick={() => setPicker(true)}>
                Kitaptan soru ekle
              </Button>
            )}
            {importBtn}
          </>
        }
      />

      {!desktop && <p className="mb-4 rounded-lg bg-warning/10 p-3 text-xs text-warning">Kitaplar yalnızca masaüstü uygulamasında çalışır.</p>}

      {books.length === 0 ? (
        <Card>
          <EmptyState
            className="py-20"
            icon={<Library size={22} />}
            title="Henüz kitap yok"
            description="PDF’i ekle (ör. 345 TYT Matematik Soru Bankası). Dosya uygulamanın kendi klasörüne kopyalanır, yalnızca bu bilgisayarda kalır."
            action={importBtn}
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {books.map((b) => {
            const used = notes.filter((n) => n.bookRef?.bookId === b.id).length
            const subject = b.subjectId ? SUBJECT_MAP[b.subjectId] : undefined
            return (
              <Card key={b.id} className="flex flex-col p-5">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent">
                    <BookOpen size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 text-sm font-semibold leading-snug">{b.title}</div>
                    <div className="mt-1 text-xs text-muted">
                      {[b.publisher, subject ? `${subject.exam} ${subject.name}` : 'Ders seçilmedi'].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                </div>
                <div className="tabular mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-subtle">
                  {b.pages && <span>{b.pages} sayfa</span>}
                  <span>{mb(b.size)}</span>
                  {b.pageOffset !== 0 && <span>kayma {b.pageOffset > 0 ? '+' : ''}{b.pageOffset}</span>}
                  {!!b.insertedPages?.length && <span title="Paylaşılan PDF'e sonradan eklenmiş reklam / kanal sayfaları; sayfa sayarken atlanır">{b.insertedPages.length} eklenmiş sayfa atlanıyor</span>}
                  <span>{used} soru alındı</span>
                  <span>{formatDate(b.createdAt.slice(0, 10))}</span>
                </div>
                <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<ScanSearch size={13} />}
                    onClick={() => {
                      localStorage.setItem('yks-last-book', b.id)
                      setPicker(true)
                    }}
                  >
                    Soru al
                  </Button>
                  <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={() => setEditing(b)}>
                    Düzenle
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto text-danger hover:bg-danger/10"
                    icon={<Trash2 size={13} />}
                    onClick={async () => {
                      if (
                        await confirm({
                          title: 'Kitap silinsin mi?',
                          message: `“${b.title}” kitaplıktan ve diskten silinir (${mb(b.size)}). Bu kitaptan Hata Defteri’ne aldığın sorular kalır.`
                        })
                      ) {
                        deleteBook(b.id)
                        toast('Kitap silindi', 'info')
                      }
                    }}
                  >
                    Sil
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {editing && <BookForm book={editing} onClose={() => setEditing(null)} />}
      {picker && <QuestionPicker mode="multi" onClose={() => setPicker(false)} />}
    </div>
  )
}
