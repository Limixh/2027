import { memo, useState } from 'react'
import { BookMarked, Check, ChevronDown, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import type { MistakeNote } from '../../../../shared/types'
import { Badge, cn } from '@/components/ui'
import { SUBJECT_MAP, TOPIC_MAP } from '@/data/curriculum'
import { MISTAKE_KIND_COLOR, MISTAKE_KIND_LABEL } from '@/lib/exam'
import { formatDate } from '@/lib/date'

function MistakeCardImpl({
  note,
  onToggle,
  onEdit,
  onDelete
}: {
  note: MistakeNote
  onToggle: (n: MistakeNote) => void
  onEdit: (n: MistakeNote) => void
  onDelete: (n: MistakeNote) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const subject = SUBJECT_MAP[note.subjectId]
  const topic = note.topicId ? TOPIC_MAP[note.topicId] : undefined
  const color = subject?.color ?? '#64748b'
  const kindColor = MISTAKE_KIND_COLOR[note.kind]
  const long = note.text.length > 220

  return (
    <article
      className={cn(
        'card group relative mb-4 break-inside-avoid overflow-hidden transition-all hover:-translate-y-px hover:border-subtle/40',
        note.resolved && 'opacity-80'
      )}
    >
      <div className="absolute inset-y-0 left-0 w-1" style={{ background: color }} />
      <div className="p-4 pl-5">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge color={color}>{subject?.name ?? 'Ders'}</Badge>
              <Badge color={kindColor}>{MISTAKE_KIND_LABEL[note.kind]}</Badge>
              {note.resolved && (
                <Badge color="#10b981">
                  <Check size={11} strokeWidth={3} /> Çözüldü
                </Badge>
              )}
            </div>
            {topic && (
              <div className="mt-1.5 truncate text-xs font-medium text-text" title={topic.name}>
                {topic.name}
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <button
              type="button"
              onClick={() => onEdit(note)}
              className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-text"
              title="Düzenle"
              aria-label="Düzenle"
            >
              <Pencil size={13} />
            </button>
            <button
              type="button"
              onClick={() => onDelete(note)}
              className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-danger/10 hover:text-danger"
              title="Sil"
              aria-label="Sil"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        <p
          className={cn(
            'whitespace-pre-wrap text-[13px] leading-relaxed text-text',
            !open && long && 'line-clamp-5',
            note.resolved && 'text-muted'
          )}
        >
          {note.text}
        </p>

        {(note.lesson || long) && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
          >
            <ChevronDown size={13} className={cn('transition-transform', open && 'rotate-180')} />
            {open ? 'Gizle' : note.lesson ? 'Doğrusu / dersi gör' : 'Devamını göster'}
          </button>
        )}

        {open && note.lesson && (
          <div className="mt-2 animate-fade-in rounded-xl border border-success/25 bg-success/5 p-3">
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-success">
              <BookMarked size={12} /> Doğrusu / çıkardığım ders
            </div>
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-text">{note.lesson}</p>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/70 pt-2.5">
          <div className="min-w-0 text-[11px] text-subtle">
            <span className="tabular">{formatDate(note.date)}</span>
            {note.source && <span className="truncate"> · {note.source}</span>}
          </div>
          <button
            type="button"
            onClick={() => onToggle(note)}
            className={cn(
              'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-[11px] font-medium transition-colors',
              note.resolved
                ? 'text-muted hover:bg-surface-2 hover:text-text'
                : 'bg-success/10 text-success hover:bg-success/20'
            )}
          >
            {note.resolved ? <RotateCcw size={12} /> : <Check size={12} strokeWidth={3} />}
            {note.resolved ? 'Tekrar aç' : 'Çözüldü olarak işaretle'}
          </button>
        </div>
      </div>
    </article>
  )
}

export const MistakeCard = memo(MistakeCardImpl)
