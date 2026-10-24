// Kitaptan soru seç: kitap + sayfa + soru numarası → sayfa açılır, sorular kutulanır, istenen soru seçili gelir.
// Yanlışsa başka kutuya tıklanır ya da sayfada sürükleyerek seçilir. Seçilen bölge kesilip görsel olarak eklenir.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2, Plus, ScanSearch } from 'lucide-react'
import type { Book, ChatAttachment, MistakeNote } from '../../../../shared/types'
import { Button, Field, Input, Modal, Select, cn, toast } from '@/components/ui'
import { SUBJECT_MAP } from '@/data/curriculum'
import { addDays, todayKey } from '@/lib/date'
import { cropImage, detectQuestions, guessIndex, loadPage, openBook, releaseBooksLater, type Box, type PageImage } from '@/lib/pdf'
import { useNav } from '@/lib/nav'
import { useStore } from '@/lib/store'

export interface PickResult {
  att: ChatAttachment
  source: string
  subjectId?: string
  bookRef: NonNullable<MistakeNote['bookRef']>
}

type Sel = { kind: 'box'; index: number } | { kind: 'custom'; box: Box } | null

export function QuestionPicker({
  mode,
  onClose,
  onPick
}: {
  /** single: bir soruya görsel ekler (onPick) · multi: her seçimi Hata Defteri'ne yeni soru olarak ekler */
  mode: 'single' | 'multi'
  onClose: () => void
  onPick?: (r: PickResult) => void
}): React.JSX.Element {
  const books = useStore((s) => s.data.books ?? [])
  const updateBook = useStore((s) => s.updateBook)
  const [bookId, setBookId] = useState(() => {
    const last = localStorage.getItem('yks-last-book')
    return books.find((b) => b.id === last)?.id ?? books[0]?.id ?? ''
  })
  const book = books.find((b) => b.id === bookId)
  const [pageText, setPageText] = useState(() => String(book?.lastPage ?? ''))
  const [qText, setQText] = useState('')
  const [shown, setShown] = useState<{ bookPage: number; pdfPage: number } | null>(null)
  const [img, setImg] = useState<PageImage | null>(null)
  const [pageUrl, setPageUrl] = useState('')
  const [boxes, setBoxes] = useState<Box[]>([])
  const [sel, setSel] = useState<Sel>(null)
  const [anchor, setAnchor] = useState(1)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [added, setAdded] = useState(0)
  const [saving, setSaving] = useState(false)
  const run = useRef(0)

  const qNum = Number(qText) || undefined

  /** Kitabın sayfasını aç ve soruları bul */
  const show = useCallback(
    async (bookPage: number, q?: number, b: Book | undefined = book) => {
      if (!b || !bookPage) return
      const id = ++run.current
      setError('')
      setSel(null)
      try {
        setStatus('Kitap açılıyor… (ilk açılış birkaç saniye sürebilir)')
        const doc = await openBook(b.rel)
        if (id !== run.current) return
        if (b.pages !== doc.numPages) updateBook(b.id, { pages: doc.numPages })
        const pdfPage = bookPage + b.pageOffset
        if (pdfPage < 1 || pdfPage > doc.numPages) throw new Error(`Bu kitapta ${doc.numPages - b.pageOffset} sayfa var`)
        setStatus('Sayfa hazırlanıyor…')
        const pi = await loadPage(doc, pdfPage)
        if (id !== run.current) return
        setImg(pi)
        setPageUrl(pi.canvas.toDataURL('image/jpeg', 0.82))
        setShown({ bookPage, pdfPage })
        setStatus('Sorular aranıyor…')
        const det = await detectQuestions(pi)
        if (id !== run.current) return
        setBoxes(det.boxes)
        const gi = q ? guessIndex(det.boxes, q) : -1
        setSel(gi >= 0 ? { kind: 'box', index: gi } : null)
        // Numaralandırma sayfa açılınca sabitlenir: tahmin edilen kutu = istenen numara, diğerleri ardışık
        setAnchor(q && gi >= 0 ? q - gi : 1)
        const nums = det.boxes.map((b) => b.number).filter((n): n is number => n !== undefined)
        setStatus(
          !det.boxes.length
            ? 'Bu sayfada soru otomatik bulunamadı; soruyu fareyle sürükleyerek seç.'
            : q && gi < 0 && nums.length
              ? `Bu sayfada ${q}. soru yok (bu sayfada ${Math.min(...nums)}–${Math.max(...nums)} var). Sayfayı değiştir ya da bir kutuya tıkla.`
              : ''
        )
        updateBook(b.id, { lastPage: bookPage })
        localStorage.setItem('yks-last-book', b.id)
      } catch (e) {
        if (id !== run.current) return
        setStatus('')
        setError(e instanceof Error ? e.message : 'Sayfa açılamadı')
      }
    },
    [book, updateBook]
  )

  // Kapanınca kitabı bir süre sonra bellekten bırak
  useEffect(() => () => releaseBooksLater(), [])

  // Esc yalnızca bu pencereyi kapatsın (not formunun içinden açıldığında form kapanıp yazılanlar kaybolmasın)
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  // Açılışta son sayfa varsa göster
  useEffect(() => {
    const p = Number(pageText)
    if (book && p) void show(p)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId])

  const go = (): void => void show(Number(pageText), qNum)

  /** Kutuların soru numarası etiketleri (PDF metninden okunduysa o, yoksa ardışık) */
  const labels = useMemo(
    () => (boxes.some((b) => b.number !== undefined) ? boxes.map((b, i) => b.number ?? anchor + i) : boxes.map((_, i) => anchor + i)),
    [boxes, anchor]
  )

  const selBox = sel?.kind === 'box' ? boxes[sel.index] : sel?.kind === 'custom' ? sel.box : undefined
  const selNumber = sel?.kind === 'box' ? labels[sel.index] : qNum
  const preview = useMemo(() => (img && selBox ? 'data:image/jpeg;base64,' + cropImage(img, selBox) : ''), [img, selBox])

  // Sayfa kayması: PDF sayfası ≠ kitap sayfası ise okla düzelt (kitap için kalıcı)
  const shiftOffset = (d: number): void => {
    if (!book || !shown) return
    const nb = { ...book, pageOffset: book.pageOffset + d }
    updateBook(book.id, { pageOffset: nb.pageOffset })
    void show(shown.bookPage, qNum, nb)
  }

  /* ---------- sürükleyerek seçme ---------- */
  const area = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null)
  const pt = (e: React.PointerEvent): { x: number; y: number } => {
    const r = area.current!.getBoundingClientRect()
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) }
  }

  const save = async (): Promise<void> => {
    if (!img || !selBox || !book || !shown) return
    if (!window.api) return toast('Kitaptan soru alma yalnızca masaüstü uygulamasında çalışır', 'error')
    setSaving(true)
    try {
      const b64 = cropImage(img, selBox)
      const att = await window.api.ai.saveAttachment(`kitap-s${shown.bookPage}${selNumber ? `-${selNumber}` : ''}.jpg`, b64)
      const source = `${book.title} · s.${shown.bookPage}${selNumber ? ` · soru ${selNumber}` : ''}`
      const bookRef = { bookId: book.id, page: shown.bookPage, question: selNumber }
      if (mode === 'single') {
        onPick?.({ att, source, subjectId: book.subjectId, bookRef })
        onClose()
        return
      }
      useStore.getState().addMistakeNote({
        subjectId: book.subjectId ?? '',
        text: '',
        kind: 'bilgi',
        resolved: false,
        date: todayKey(),
        source,
        questionImages: [att],
        inbox: true,
        nextReview: addDays(todayKey(), 1),
        bookRef
      })
      setAdded((n) => n + 1)
      toast(`Eklendi: s.${shown.bookPage}${selNumber ? ` soru ${selNumber}` : ''}`)
      setQText('')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Kaydedilemedi', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!books.length)
    return (
      <Modal open onClose={onClose} title="Kitaptan soru al" width={480}>
        <p className="text-sm text-muted">Henüz kitap eklemedin. Soru bankası PDF’lerini Kitaplarım’a ekle; sonra sayfa ve soru numarasıyla soruyu buradan alırsın.</p>
        <div className="mt-5 flex justify-end">
          <Button
            variant="primary"
            onClick={() => {
              onClose()
              useNav.getState().go('books')
            }}
          >
            Kitaplarım’a git
          </Button>
        </div>
      </Modal>
    )

  return (
    <Modal
      open
      onClose={onClose}
      title="Kitaptan soru al"
      subtitle={mode === 'multi' ? 'Seçtiğin her soru Hata Defteri’ne eklenir; bilgilerini sonra Toplu giriş ile girersin.' : 'Seçtiğin soru bu notun soru görseli olur.'}
      width={1180}
      footer={
        <>
          {mode === 'multi' && added > 0 && <span className="mr-auto self-center text-xs text-muted">Bu oturumda {added} soru eklendi</span>}
          <Button variant="ghost" onClick={onClose}>
            {mode === 'multi' && added ? 'Bitti' : 'Vazgeç'}
          </Button>
          <Button variant="primary" icon={saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} disabled={!selBox || saving} onClick={() => void save()}>
            {mode === 'multi' ? 'Hata Defteri’ne ekle' : 'Soruya ekle'}
          </Button>
        </>
      }
    >
      <div className="grid gap-6 md:grid-cols-[280px_minmax(0,1fr)]">
        {/* Sol: kitap, sayfa, soru + önizleme */}
        <div className="space-y-4">
          <Field label="Kitap">
            <Select
              value={bookId}
              onChange={(e) => {
                setBookId(e.target.value)
                const nb = books.find((b) => b.id === e.target.value)
                setPageText(String(nb?.lastPage ?? ''))
                setImg(null)
                setBoxes([])
                setShown(null)
              }}
            >
              {books.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sayfa">
              <Input autoFocus inputMode="numeric" value={pageText} onChange={(e) => setPageText(e.target.value.replace(/\D/g, ''))} onKeyDown={(e) => e.key === 'Enter' && go()} placeholder="ör. 45" />
            </Field>
            <Field label="Soru no">
              <Input inputMode="numeric" value={qText} onChange={(e) => setQText(e.target.value.replace(/\D/g, ''))} onKeyDown={(e) => e.key === 'Enter' && go()} placeholder="ör. 7" />
            </Field>
          </div>
          <Button variant="outline" className="w-full justify-center" icon={<ScanSearch size={14} />} disabled={!book || !Number(pageText)} onClick={go}>
            Soruyu bul
          </Button>

          {status && (
            <p className="flex items-start gap-2 text-xs text-muted">
              {status.endsWith('…') && <Loader2 size={13} className="mt-0.5 shrink-0 animate-spin" />}
              {status}
            </p>
          )}
          {error && <p className="text-xs text-danger">{error}</p>}

          {preview && (
            <div>
              <span className="label">Eklenecek{selNumber ? ` · soru ${selNumber}` : ''}</span>
              <img src={preview} alt="Seçilen soru" className="max-h-[280px] w-full rounded-lg border border-border bg-white object-contain" />
            </div>
          )}
          {book && <p className="text-[11px] leading-relaxed text-subtle">Ders: {book.subjectId ? SUBJECT_MAP[book.subjectId]?.name : '—'} · Kutu yanlışsa doğru kutuya tıkla ya da sayfada sürükleyerek seç.</p>}
        </div>

        {/* Sağ: sayfa */}
        <div className="min-w-0">
          {shown && book && (
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" aria-label="Önceki sayfa" onClick={() => (setPageText(String(shown.bookPage - 1)), void show(shown.bookPage - 1, qNum))}>
                  <ChevronLeft size={15} />
                </Button>
                <span className="tabular">Kitap s.{shown.bookPage}</span>
                <Button variant="ghost" size="icon" aria-label="Sonraki sayfa" onClick={() => (setPageText(String(shown.bookPage + 1)), void show(shown.bookPage + 1, qNum))}>
                  <ChevronRight size={15} />
                </Button>
              </div>
              <div className="flex items-center gap-1" title="Kitabın üzerindeki sayfa numarası PDF sayfasıyla aynı değilse buradan kaydır; kitap için hatırlanır">
                <span>Sayfa kaymış mı?</span>
                <Button variant="ghost" size="sm" onClick={() => shiftOffset(-1)}>
                  ‹ önceki PDF sayfası
                </Button>
                <Button variant="ghost" size="sm" onClick={() => shiftOffset(1)}>
                  sonraki ›
                </Button>
                <span className="tabular text-subtle">(PDF s.{shown.pdfPage})</span>
              </div>
            </div>
          )}
          {pageUrl ? (
            <div className="max-h-[72vh] overflow-y-auto rounded-lg border border-border bg-white">
              <div
                ref={area}
                className="relative cursor-crosshair select-none"
                onPointerDown={(e) => {
                  if ((e.target as HTMLElement).dataset.box) return
                  const p = pt(e)
                  try {
                    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
                  } catch {
                    /* yakalama desteklenmiyorsa sürükleme yine çalışır */
                  }
                  setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y })
                }}
                onPointerMove={(e) => drag && setDrag((d) => d && { ...d, ...((p) => ({ x1: p.x, y1: p.y }))(pt(e)) })}
                onPointerUp={() => {
                  if (drag && Math.abs(drag.x1 - drag.x0) > 0.03 && Math.abs(drag.y1 - drag.y0) > 0.02) {
                    setSel({
                      kind: 'custom',
                      box: { x0: Math.min(drag.x0, drag.x1), y0: Math.min(drag.y0, drag.y1), x1: Math.max(drag.x0, drag.x1), y1: Math.max(drag.y0, drag.y1) }
                    })
                  }
                  setDrag(null)
                }}
              >
                <img src={pageUrl} alt="Kitap sayfası" className="pointer-events-none block w-full" draggable={false} />
                {boxes.map((b, i) => {
                  const on = sel?.kind === 'box' && sel.index === i
                  return (
                    <button
                      key={i}
                      type="button"
                      data-box="1"
                      onClick={() => setSel({ kind: 'box', index: i })}
                      className={cn(
                        'absolute rounded-md border-2 transition-colors',
                        on ? 'border-accent bg-accent/10' : 'border-accent/30 hover:border-accent/70 hover:bg-accent/5'
                      )}
                      style={{ left: `${b.x0 * 100}%`, top: `${b.y0 * 100}%`, width: `${(b.x1 - b.x0) * 100}%`, height: `${(b.y1 - b.y0) * 100}%` }}
                    >
                      <span
                        data-box="1"
                        className={cn(
                          'absolute -left-px -top-px rounded-br-md rounded-tl-md px-1.5 text-[11px] font-semibold',
                          on ? 'bg-accent text-on-accent' : 'bg-accent/60 text-white'
                        )}
                      >
                        {labels[i]}
                      </span>
                    </button>
                  )
                })}
                {sel?.kind === 'custom' && (
                  <div
                    className="pointer-events-none absolute rounded-md border-2 border-accent bg-accent/10"
                    style={{ left: `${sel.box.x0 * 100}%`, top: `${sel.box.y0 * 100}%`, width: `${(sel.box.x1 - sel.box.x0) * 100}%`, height: `${(sel.box.y1 - sel.box.y0) * 100}%` }}
                  />
                )}
                {drag && (
                  <div
                    className="pointer-events-none absolute border-2 border-dashed border-accent"
                    style={{ left: `${Math.min(drag.x0, drag.x1) * 100}%`, top: `${Math.min(drag.y0, drag.y1) * 100}%`, width: `${Math.abs(drag.x1 - drag.x0) * 100}%`, height: `${Math.abs(drag.y1 - drag.y0) * 100}%` }}
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="grid h-[60vh] place-items-center rounded-lg border border-dashed border-border text-sm text-subtle">
              Sayfa ve soru numarasını yazıp “Soruyu bul”a bas
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
