import { useState, type ReactNode } from 'react'
import { ChevronDown, ListChecks } from 'lucide-react'
import type { Subject, Topic, TopicStatus } from '../../../../shared/types'
import { cn } from '@/components/ui'
import { STATUS_META } from './meta'

function BulkMenu({ onPick }: { onPick: (s: TopicStatus) => void }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] font-medium text-muted transition-colors hover:bg-surface-3 hover:text-text"
        title="Bu dersteki görünen tüm konular için toplu işlem"
      >
        <ListChecks size={13} />
        Toplu işlem
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-40 w-56 animate-scale-in rounded-xl border border-border bg-surface p-1 shadow-card">
            {STATUS_META.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => {
                  setOpen(false)
                  onPick(m.value)
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-text hover:bg-surface-2"
              >
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: m.color }} />
                {m.value === 0 ? 'Tümünü sıfırla (Başlanmadı)' : `Tümünü “${m.label}” yap`}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export function SubjectSection({
  subject,
  topics,
  counts,
  done,
  total,
  collapsible,
  collapsed,
  onToggle,
  onBulk,
  renderRow
}: {
  subject: Subject
  /** süzülmüş konular */
  topics: Topic[]
  /** durum dağılımı (dersin tamamı) */
  counts: number[]
  done: number
  total: number
  collapsible: boolean
  collapsed: boolean
  onToggle: () => void
  onBulk: (s: TopicStatus) => void
  renderRow: (t: Topic) => ReactNode
}): React.JSX.Element {
  // gruplara ayır (sıra korunur)
  const groups: { name?: string; items: Topic[] }[] = []
  for (const t of topics) {
    const last = groups[groups.length - 1]
    if (last && last.name === t.group) last.items.push(t)
    else groups.push({ name: t.group, items: [t] })
  }
  const pct = total ? done / total : 0

  return (
    <section className="card" data-topic-list>
      <div className="sticky top-10 z-20 flex items-center gap-3 rounded-t-2xl border-b border-border bg-surface/95 px-4 py-2.5 backdrop-blur">
        <button
          type="button"
          onClick={collapsible ? onToggle : undefined}
          className={cn('flex min-w-0 flex-1 items-center gap-2.5 text-left', !collapsible && 'cursor-default')}
        >
          {collapsible && (
            <ChevronDown size={15} className={cn('shrink-0 text-subtle transition-transform', collapsed && '-rotate-90')} />
          )}
          <span className="h-5 w-1.5 shrink-0 rounded-full" style={{ background: subject.color }} />
          <span className="truncate text-sm font-semibold text-text">{subject.name}</span>
          <span className="tabular shrink-0 text-xs text-muted">
            {done}/{total} konu bitti
          </span>
          {topics.length !== total && (
            <span className="shrink-0 rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
              {topics.length} eşleşme
            </span>
          )}
        </button>

        {/* durum dağılımı */}
        <div className="hidden items-center gap-3 md:flex">
          <div className="flex h-1.5 w-40 overflow-hidden rounded-full bg-surface-3" title="Konu durum dağılımı">
            {counts.map((c, i) =>
              c > 0 && i > 0 ? (
                <div key={i} style={{ width: `${(c / total) * 100}%`, background: STATUS_META[i].color }} />
              ) : null
            )}
          </div>
          <span className="tabular w-9 text-right text-xs font-semibold text-text">%{Math.round(pct * 100)}</span>
        </div>
        <BulkMenu onPick={onBulk} />
      </div>

      {!collapsed && (
        <div>
          {groups.map((g, gi) => (
            <div key={gi}>
              {g.name && (
                <div className="flex items-center gap-2 border-b border-border/60 bg-surface-2/50 px-4 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-subtle">
                  {g.name}
                  <span className="tabular font-medium normal-case tracking-normal">· {g.items.length}</span>
                </div>
              )}
              {g.items.map((t) => renderRow(t))}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
