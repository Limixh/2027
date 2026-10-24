import { ChevronDown, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { PracticeSet } from '../../../../shared/types'
import { Button } from '@/components/ui'
import { SUBJECT_MAP, TOPIC_MAP } from '@/data/curriculum'
import { relativeDay } from '@/lib/date'
import { QuestionChart } from './QuestionChart'
import { fmtDur } from './lib'

export function PracticeHistory({
  sets,
  onEdit,
  onDelete
}: {
  sets: PracticeSet[]
  onEdit: (s: PracticeSet) => void
  onDelete: (s: PracticeSet) => void
}): React.JSX.Element {
  const [open, setOpen] = useState<string | null>(null)
  const [limit, setLimit] = useState(15)
  const sorted = [...sets].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))

  return (
    <div>
      <div className="divide-y divide-border border-y border-border">
        {sorted.slice(0, limit).map((s) => {
          const subj = SUBJECT_MAP[s.subjectId]
          const topic = s.topicId ? TOPIC_MAP[s.topicId]?.name : undefined
          const live = !!s.perQuestion?.length
          const expanded = open === s.id
          return (
            <div key={s.id}>
              <div className="group flex items-center gap-4 py-3">
                <div className="w-24 shrink-0 text-sm text-muted">{relativeDay(s.date)}</div>
                <button
                  className={`min-w-0 flex-1 text-left ${live ? 'cursor-pointer' : 'cursor-default'}`}
                  onClick={() => live && setOpen(expanded ? null : s.id)}
                >
                  <div className="flex items-center gap-1.5 truncate text-sm text-text">
                    {subj ? `${subj.exam} ${subj.short}` : 'Ders'}
                    {topic && <span className="text-muted"> · {topic}</span>}
                    {live && <ChevronDown size={13} className={`shrink-0 text-subtle transition-transform ${expanded ? 'rotate-180' : ''}`} />}
                  </div>
                  <div className="tabular mt-0.5 truncate text-xs text-muted">
                    {s.count} soru · {s.seconds < 60 ? `${s.seconds} sn` : `${Math.round(s.seconds / 60)} dk`} · {fmtDur(s.seconds / s.count)}/soru ·{' '}
                    <span className="text-success">{s.correct}D</span> <span className="text-danger">{s.wrong}Y</span> {s.blank}B
                    {s.source && <span className="text-subtle"> · {s.source}</span>}
                    {s.note && <span className="text-subtle"> · {s.note}</span>}
                  </div>
                </button>
                <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                  <Button variant="ghost" size="icon" onClick={() => onEdit(s)} aria-label="Düzenle" title="Düzenle">
                    <Pencil size={14} />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onDelete(s)} aria-label="Sil" title="Sil" className="hover:text-danger">
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
              {expanded && s.perQuestion && (
                <div className="pb-4 pl-28">
                  <QuestionChart times={s.perQuestion} results={s.perResult ?? []} avg={s.seconds / s.count} height={150} />
                </div>
              )}
            </div>
          )
        })}
      </div>
      {sorted.length > limit && (
        <div className="mt-3 text-center">
          <Button variant="ghost" size="sm" onClick={() => setLimit((l) => l + 15)}>
            Daha fazla göster
          </Button>
        </div>
      )}
    </div>
  )
}
