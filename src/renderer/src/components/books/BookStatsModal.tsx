// Bir kitabın istatistikleri: bu kitaptan kaç soru çözemedim, hangi konular, hangi hata türleri, hangi sayfalar.
import { useMemo } from 'react'
import { ArrowRight } from 'lucide-react'
import type { Book } from '../../../../shared/types'
import { Button, Modal, cn } from '@/components/ui'
import { SUBJECT_MAP } from '@/data/curriculum'
import { bookStats } from '@/lib/bookStats'
import { formatDate } from '@/lib/date'
import { MISTAKE_KIND_COLOR, MISTAKE_KIND_LABEL } from '@/lib/exam'
import { useNav } from '@/lib/nav'
import { useStore } from '@/lib/store'

function Bar({ value, max, color }: { value: number; max: number; color?: string }): React.JSX.Element {
  return (
    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
      <div className="h-full rounded-full" style={{ width: `${max ? Math.max(4, (value / max) * 100) : 0}%`, background: color ?? 'rgb(var(--accent))' }} />
    </div>
  )
}

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }): React.JSX.Element {
  return (
    <section className={cn('rounded-xl border border-border p-4', className)}>
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-subtle">{title}</h3>
      {children}
    </section>
  )
}

export function BookStatsModal({ book, onClose }: { book: Book; onClose: () => void }): React.JSX.Element {
  const notes = useStore((s) => s.data.mistakeNotes)
  const s = useMemo(() => bookStats(notes, book.id), [notes, book.id])
  const subject = book.subjectId ? SUBJECT_MAP[book.subjectId] : undefined
  const maxTopic = s.topics[0]?.n ?? 0
  const maxKind = s.byKind[0]?.n ?? 0
  const maxPage = Math.max(0, ...s.pages.map((p) => p.n))
  const maxMonth = Math.max(0, ...s.months.map((m) => m.n))
  const learnedPct = s.total ? Math.round((s.learned / s.total) * 100) : 0

  return (
    <Modal
      open
      onClose={onClose}
      title={book.title}
      subtitle={[book.publisher, subject ? `${subject.exam} ${subject.name}` : undefined, book.rel ? 'PDF' : 'Basılı kitap'].filter(Boolean).join(' · ')}
      width={860}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Kapat
          </Button>
          <Button
            variant="primary"
            icon={<ArrowRight size={14} />}
            disabled={!s.total}
            onClick={() => {
              onClose()
              useNav.getState().go('mistakes', { book: book.id })
            }}
          >
            Bu kitabın soruları
          </Button>
        </>
      }
    >
      {!s.total ? (
        <p className="py-10 text-center text-sm text-muted">
          Bu kitaptan henüz Hata Defteri’ne soru eklenmedi. Soru eklerken “Kitap” alanından bu kitabı seç; istatistikler burada birikir.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Çözemediğim soru', s.total, undefined],
              ['Açık', s.open, s.due ? `${s.due} tanesi bugün tekrar` : undefined],
              ['Öğrenildi', `%${learnedPct}`, `${s.learned} soru`],
              ['AI ile analiz', s.analyzed, s.retries.tries ? `tekrarda ${s.retries.solved}/${s.retries.tries} çözüldü` : undefined]
            ].map(([k, v, sub]) => (
              <div key={k as string} className="rounded-xl border border-border px-4 py-3">
                <div className="text-[11px] text-subtle">{k}</div>
                <div className="tabular mt-1 text-2xl font-semibold tracking-tight">{v}</div>
                {sub && <div className="mt-0.5 text-[11px] text-muted">{sub}</div>}
              </div>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Section title="En çok takıldığım konular">
              <ul className="space-y-2">
                {s.topics.slice(0, 8).map((t) => (
                  <li key={t.key} className="flex items-center gap-3 text-sm">
                    <div className="w-44 min-w-0 shrink-0">
                      <div className="truncate">{t.name}</div>
                      {t.subject && <div className="truncate text-[11px] text-subtle">{t.subject}</div>}
                    </div>
                    <Bar value={t.n} max={maxTopic} />
                    <span className="tabular w-14 shrink-0 text-right text-xs text-muted">
                      {t.n}
                      {t.open < t.n && <span className="text-subtle"> · {t.open} açık</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>

            <Section title="Hata türleri">
              <ul className="space-y-2">
                {s.byKind.map((k) => (
                  <li key={k.kind} className="flex items-center gap-3 text-sm">
                    <span className="flex w-32 shrink-0 items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: MISTAKE_KIND_COLOR[k.kind] }} />
                      {MISTAKE_KIND_LABEL[k.kind]}
                    </span>
                    <Bar value={k.n} max={maxKind} color={MISTAKE_KIND_COLOR[k.kind]} />
                    <span className="tabular w-8 shrink-0 text-right text-xs text-muted">{k.n}</span>
                  </li>
                ))}
              </ul>
            </Section>

            <Section title="Sayfalara göre">
              {s.pages.length ? (
                <ul className="space-y-1.5">
                  {s.pages.map((p) => (
                    <li key={p.from} className="flex items-center gap-3 text-xs">
                      <span className="tabular w-20 shrink-0 text-muted">
                        s.{p.from}–{p.to}
                      </span>
                      <Bar value={p.n} max={maxPage} />
                      <span className="tabular w-8 shrink-0 text-right text-muted">{p.n}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted">Sorulara sayfa numarası girildikçe hangi bölümlerde zorlandığın burada görünür.</p>
              )}
            </Section>

            <Section title="Son 6 ay">
              <div className="flex h-28 items-end gap-2">
                {s.months.map((m) => (
                  <div key={m.key} className="flex flex-1 flex-col items-center gap-1">
                    <span className="tabular text-[10px] text-muted">{m.n || ''}</span>
                    <div className="w-full rounded-t bg-accent/70" style={{ height: `${maxMonth ? Math.max(m.n ? 6 : 2, (m.n / maxMonth) * 80) : 2}px` }} />
                    <span className="text-[10px] text-subtle">{m.label}</span>
                  </div>
                ))}
              </div>
              {s.firstDate && (
                <p className="mt-2 text-[11px] text-subtle">
                  İlk soru {formatDate(s.firstDate)}, son soru {formatDate(s.lastDate!)}
                </p>
              )}
            </Section>
          </div>
        </div>
      )}
    </Modal>
  )
}
