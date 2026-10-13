import { memo, type KeyboardEvent } from 'react'
import { AlertCircle, RotateCcw, StickyNote } from 'lucide-react'
import type { Topic, TopicProgress, TopicStatus } from '../../../../shared/types'
import { formatShort } from '@/lib/date'
import { cn } from '@/components/ui'
import { ROW_GRID, STATUS_META, type Tier } from './meta'

export interface SolvedInfo {
  solved: number
  correct: number
  wrong: number
}

function StatusStepper({
  status,
  onChange,
  showLabel
}: {
  status: TopicStatus
  onChange: (s: TopicStatus) => void
  showLabel: boolean
}): React.JSX.Element {
  const meta = STATUS_META[status]
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-[3px]" role="group" aria-label="Durum">
        {STATUS_META.slice(1).map((m) => {
          const filled = m.value <= status
          return (
            <button
              key={m.value}
              type="button"
              tabIndex={-1}
              title={m.label}
              aria-label={m.label}
              aria-pressed={status === m.value}
              onClick={(e) => {
                e.stopPropagation()
                onChange(status === m.value ? ((m.value - 1) as TopicStatus) : m.value)
              }}
              className={cn(
                'h-[18px] w-[22px] rounded-[5px] transition-all duration-150 hover:scale-y-110',
                !filled && 'bg-surface-3 hover:bg-subtle/40'
              )}
              style={filled ? { background: meta.color } : undefined}
            />
          )
        })}
      </div>
      {showLabel && (
        <span
          className="truncate text-[11px] font-medium"
          style={{ color: status === 0 ? 'rgb(var(--subtle))' : meta.color }}
        >
          {meta.label}
        </span>
      )}
    </div>
  )
}

function Confidence({ value, onChange }: { value?: number; onChange: (v: number | undefined) => void }): React.JSX.Element {
  return (
    <div className="flex items-center gap-[5px]" role="group" aria-label="Öz güven">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          tabIndex={-1}
          title={`Öz güven: ${i}/5`}
          aria-label={`Öz güven ${i}`}
          onClick={(e) => {
            e.stopPropagation()
            onChange(value === i ? undefined : i)
          }}
          className={cn(
            'h-[10px] w-[10px] rounded-full border transition-all hover:scale-125',
            value !== undefined && i <= value
              ? 'border-accent bg-accent'
              : 'border-subtle/50 bg-transparent hover:border-accent'
          )}
        />
      ))}
    </div>
  )
}

interface Props {
  topic: Topic
  tier: Tier
  progress?: TopicProgress
  solved?: SolvedInfo
  mistakes: number
  /** Tekrarı gelmişse gecikme günü */
  overdue?: number
  onStatus: (id: string, status: TopicStatus) => void
  onConfidence: (id: string, v: number | undefined) => void
  onReview: (id: string) => void
  onNote: (id: string) => void
}

function TopicRowImpl({
  topic,
  tier,
  progress,
  solved,
  mistakes,
  overdue,
  onStatus,
  onConfidence,
  onReview,
  onNote
}: Props): React.JSX.Element {
  const status = (progress?.status ?? 0) as TopicStatus
  const meta = STATUS_META[status]
  const due = overdue !== undefined
  const acc = solved && solved.correct + solved.wrong > 0 ? solved.correct / (solved.correct + solved.wrong) : undefined
  const accColor = acc === undefined ? undefined : acc >= 0.8 ? '#51b896' : acc >= 0.6 ? '#bd934c' : '#c46e6e'

  const onKey = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.target !== e.currentTarget) return
    if (e.key >= '0' && e.key <= '4') {
      e.preventDefault()
      onStatus(topic.id, Number(e.key) as TopicStatus)
    } else if (e.key === 'ArrowRight' && status < 4) {
      e.preventDefault()
      onStatus(topic.id, (status + 1) as TopicStatus)
    } else if (e.key === 'ArrowLeft' && status > 0) {
      e.preventDefault()
      onStatus(topic.id, (status - 1) as TopicStatus)
    } else if (e.key === 'r' || e.key === 'R') {
      if (status >= 2) onReview(topic.id)
    } else if (e.key === 'n' || e.key === 'N') {
      e.preventDefault()
      onNote(topic.id)
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const list = e.currentTarget.closest('[data-topic-list]')
      const rows = list ? Array.from(list.querySelectorAll<HTMLElement>('[data-topic-row]')) : []
      const i = rows.indexOf(e.currentTarget)
      rows[i + (e.key === 'ArrowDown' ? 1 : -1)]?.focus()
    }
  }

  const reviewBtn =
    status >= 2 ? (
      <button
        type="button"
        tabIndex={-1}
        onClick={(e) => {
          e.stopPropagation()
          onReview(topic.id)
        }}
        title="Bugün tekrar ettim (R)"
        className={cn(
          'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md text-[11px] font-medium transition-colors',
          tier === 'wide' ? 'px-2' : 'w-7 justify-center',
          due
            ? 'bg-warning/15 text-warning hover:bg-warning/25'
            : 'text-muted hover:bg-surface-3 hover:text-text'
        )}
      >
        <RotateCcw size={12} />
        {tier === 'wide' && 'Tekrar ettim'}
      </button>
    ) : (
      <span className="w-7" />
    )

  const dateText =
    status >= 2 && progress?.lastReview ? (
      <span className="tabular truncate text-[11px] text-subtle" title={`Son tekrar: ${progress.lastReview}`}>
        {formatShort(progress.lastReview)}
        {progress.reviews ? <span className="ml-1 text-muted">×{progress.reviews}</span> : null}
      </span>
    ) : (
      <span />
    )

  const solvedCell = solved && solved.solved > 0 && (
    <span className="tabular flex items-baseline gap-1 text-[11px] text-muted" title={`${solved.solved} soru çözüldü (${solved.correct} D / ${solved.wrong} Y)`}>
      <span className="font-medium text-text">{solved.solved}</span>
      <span>soru</span>
      {acc !== undefined && (
        <span className="font-semibold" style={{ color: accColor }}>
          %{Math.round(acc * 100)}
        </span>
      )}
    </span>
  )

  const mistakeCell = mistakes > 0 && (
    <span
      className="tabular inline-flex items-center gap-1 rounded-md bg-danger/10 px-1.5 py-0.5 text-[11px] font-semibold text-danger"
      title={`Denemelerde bu konudan ${mistakes} yanlış/boş soru`}
    >
      <AlertCircle size={11} />
      {mistakes}
    </span>
  )

  return (
    <div
      data-topic-row
      tabIndex={0}
      onKeyDown={onKey}
      className={cn(
        'group relative grid min-h-[40px] items-center gap-3 border-b border-border/60 px-4 py-1 outline-none transition-colors last:border-b-0 hover:bg-surface-2/70 focus-visible:bg-accent/5 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent/50'
      )}
      style={{ gridTemplateColumns: ROW_GRID[tier] }}
    >
      <span
        className="absolute bottom-1.5 left-0 top-1.5 w-[3px] rounded-r-full transition-colors"
        style={{ background: status === 0 ? 'transparent' : meta.color }}
      />
      <div className="min-w-0">
        <div
          className={cn('truncate text-[13px]', status === 4 ? 'text-muted' : 'text-text')}
          title={topic.name}
        >
          {topic.name}
        </div>
      </div>

      <StatusStepper status={status} onChange={(s) => onStatus(topic.id, s)} showLabel={tier === 'wide'} />

      {tier !== 'narrow' && <Confidence value={progress?.confidence} onChange={(v) => onConfidence(topic.id, v)} />}

      {tier === 'wide' && (
        <>
          <div className="min-w-0">{solvedCell}</div>
          <div>{mistakeCell}</div>
        </>
      )}
      {tier === 'mid' && (
        <div className="flex min-w-0 items-center gap-2">
          {solvedCell}
          {mistakeCell}
        </div>
      )}

      {tier === 'narrow' ? (
        reviewBtn
      ) : (
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            {dateText}
            {due && (
              <span
                className="rounded bg-warning/15 px-1 py-px text-[10px] font-semibold text-warning"
                title={overdue === 0 ? 'Tekrarı bugün' : `Tekrarı ${overdue} gün gecikti`}
              >
                {tier === 'wide' ? 'Tekrar zamanı' : 'Tekrar'}
              </span>
            )}
          </div>
          {reviewBtn}
        </div>
      )}

      <button
        type="button"
        tabIndex={-1}
        onClick={(e) => {
          e.stopPropagation()
          onNote(topic.id)
        }}
        title={progress?.note ? progress.note : 'Not ekle (N)'}
        className={cn(
          'grid h-7 w-7 place-items-center rounded-md transition-colors hover:bg-surface-3',
          progress?.note ? 'text-accent' : 'text-subtle opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'
        )}
      >
        <StickyNote size={14} fill={progress?.note ? 'currentColor' : 'none'} fillOpacity={0.2} />
      </button>
    </div>
  )
}

export const TopicRow = memo(TopicRowImpl)
