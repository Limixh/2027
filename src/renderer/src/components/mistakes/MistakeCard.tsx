import { memo } from 'react'
import { Check, Pencil, Smartphone, Trash2 } from 'lucide-react'
import type { MistakeNote } from '../../../../shared/types'
import { cn } from '@/components/ui'
import { SUBJECT_MAP, TOPIC_MAP } from '@/data/curriculum'
import { MISTAKE_KIND_COLOR, MISTAKE_KIND_LABEL } from '@/lib/exam'
import { formatDate, todayKey } from '@/lib/date'
import { NoteImage } from './NoteImage'

function MistakeCardImpl({
  note,
  onOpen,
  onEdit,
  onDelete
}: {
  note: MistakeNote
  onOpen: (n: MistakeNote) => void
  onEdit: (n: MistakeNote) => void
  onDelete: (n: MistakeNote) => void
}): React.JSX.Element {
  const subject = SUBJECT_MAP[note.subjectId]
  const topic = note.topicId ? TOPIC_MAP[note.topicId] : undefined
  const thumb = note.questionImages?.[0] ?? note.attemptImages?.[0]
  const due = !!note.nextReview && note.nextReview <= todayKey() && !note.resolved
  const extra = (note.questionImages?.length ?? 0) + (note.attemptImages?.length ?? 0) - 1

  return (
    <article
      onClick={() => onOpen(note)}
      className={cn(
        'group relative mb-4 cursor-pointer break-inside-avoid overflow-hidden rounded-xl border border-border bg-surface transition-colors hover:border-subtle/60',
        note.resolved && 'opacity-70'
      )}
    >
      {thumb && (
        <div className="relative h-36 border-b border-border bg-surface-2">
          <NoteImage att={thumb} className="h-full w-full" imgClassName="h-full w-full object-cover object-top" />
          {extra > 0 && (
            <span className="tabular absolute bottom-2 right-2 rounded bg-black/55 px-1.5 text-[10px] font-medium text-white">+{extra}</span>
          )}
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: subject?.color ?? '#7b838f' }} />
              <span className="truncate">{subject?.name ?? 'Ders seçilmedi'}</span>
              <span className="text-subtle">·</span>
              <span style={{ color: MISTAKE_KIND_COLOR[note.kind] }}>{MISTAKE_KIND_LABEL[note.kind]}</span>
            </div>
            {topic && (
              <div className="mt-1 truncate text-sm font-medium text-text" title={topic.name}>
                {topic.name}
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onEdit(note)
              }}
              className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-text"
              title="Düzenle"
              aria-label="Düzenle"
            >
              <Pencil size={13} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(note)
              }}
              className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-danger/10 hover:text-danger"
              title="Sil"
              aria-label="Sil"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {note.text.trim() && (
          <p className={cn('mt-2 line-clamp-4 whitespace-pre-wrap text-[13px] leading-relaxed', note.resolved ? 'text-muted' : 'text-text')}>
            {note.text}
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-subtle">
          <span className="tabular">{formatDate(note.date)}</span>
          {note.inbox && (
            <span className="inline-flex items-center gap-1 font-medium text-info">
              <Smartphone size={11} /> Telefondan geldi
            </span>
          )}
          {due && <span className="font-medium text-warning">Tekrar zamanı</span>}
          {note.resolved && (
            <span className="inline-flex items-center gap-1 font-medium text-success">
              <Check size={11} strokeWidth={3} /> Öğrenildi
            </span>
          )}
          {note.aiAnalysis && <span>AI analizli</span>}
        </div>
      </div>
    </article>
  )
}

export const MistakeCard = memo(MistakeCardImpl)
