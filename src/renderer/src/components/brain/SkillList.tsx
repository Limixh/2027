import { Network } from 'lucide-react'
import { STATUS_COLOR, STATUS_LABEL } from '@/lib/brain'
import { relativeDay } from '@/lib/date'
import { cn } from '@/components/ui'
import { isCross, type SkillRow } from './shared'

export function SkillList({
  skills,
  selectedId,
  onSelect
}: {
  skills: SkillRow[]
  selectedId?: string
  onSelect: (id: string) => void
}): React.JSX.Element {
  if (!skills.length) return <p className="px-3 py-10 text-center text-xs text-subtle">Eşleşen beceri yok.</p>
  return (
    <ul className="space-y-0.5">
      {skills.map((s) => {
        const color = STATUS_COLOR[s.strength.status]
        const active = s.id === selectedId
        return (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onSelect(s.id)}
              className={cn(
                'group relative w-full rounded-lg px-3 py-2.5 text-left transition-colors',
                active ? 'bg-surface-2' : 'hover:bg-surface-2/60'
              )}
            >
              <span
                className={cn('absolute left-0 top-3 h-[calc(100%-1.5rem)] w-0.5 rounded-full transition-opacity', active ? 'opacity-100' : 'opacity-0')}
                style={{ background: color }}
              />
              <div className="line-clamp-2 text-[13px] font-medium leading-snug text-text">{s.name}</div>
              <div className="mt-2 flex items-center gap-2.5">
                <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-surface-3">
                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(3, s.strength.score)}%`, background: color }} />
                </div>
                <span className="tabular w-[84px] text-right text-[11px] text-muted">
                  <span style={{ color }}>{STATUS_LABEL[s.strength.status]}</span> · {s.strength.score}
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-2 text-[11px] text-subtle">
                {isCross(s) && (
                  <span className="inline-flex items-center gap-1 text-accent">
                    <Network size={11} strokeWidth={2} />
                    {s.topicIds.length} konuda
                  </span>
                )}
                {!isCross(s) && <span>{s.topicIds.length === 1 ? '1 konu' : 'Konu yok'}</span>}
                <span aria-hidden>·</span>
                <span>{s.evidence.length} kanıt</span>
                {s.strength.lastSeen && (
                  <>
                    <span aria-hidden className="ml-auto" />
                    <span className="ml-auto">{relativeDay(s.strength.lastSeen)}</span>
                  </>
                )}
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
