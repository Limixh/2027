// Genel Bakış: İkinci Beyin'den odaklanılacak beceriler ve bugünün beceri tekrarı.
import { useMemo } from 'react'
import { ArrowRight, Brain, Play } from 'lucide-react'
import { Button, Card, CardHeader } from '@/components/ui'
import { focusSkills, reviewQueue, STATUS_COLOR, STATUS_LABEL } from '@/lib/brain'
import { useNav } from '@/lib/nav'
import { useStore } from '@/lib/store'

export function FocusSkillsCard(): React.JSX.Element | null {
  const data = useStore((s) => s.data)
  const go = useNav((s) => s.go)
  const focus = useMemo(() => focusSkills(data, 3), [data])
  const due = useMemo(() => reviewQueue(data, 5).length, [data])
  if (!data.skills.length) return null
  return (
    <Card className="mt-4">
      <CardHeader
        icon={<Brain size={16} />}
        title="Odaklanman gereken beceriler"
        subtitle="İkinci Beyin · kök nedenler önce"
        action={
          <div className="flex items-center gap-1">
            {due > 0 && (
              <Button variant="outline" size="sm" icon={<Play size={13} />} onClick={() => go('brain')}>
                Bugün {due} beceri tekrarı
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => go('brain')} icon={<ArrowRight size={14} />}>
              İkinci Beyin
            </Button>
          </div>
        }
      />
      {focus.length === 0 ? (
        <p className="mt-3 border-t border-border px-5 py-5 text-sm text-muted">Tüm becerilerin oturmuş görünüyor. Yeni sorular ekledikçe burası güncellenir.</p>
      ) : (
        <div className="mt-3 grid grid-cols-1 divide-y divide-border border-t border-border md:grid-cols-3 md:divide-x md:divide-y-0">
          {focus.map(({ skill, reason }) => (
            <button
              key={skill.id}
              type="button"
              onClick={() => go('brain', { skill: skill.id })}
              className="px-5 py-4 text-left transition-colors hover:bg-surface-2/60"
            >
              <div className="line-clamp-2 text-sm font-medium leading-snug">{skill.name}</div>
              <div className="mt-2.5 flex items-center gap-2.5">
                <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-surface-3">
                  <div className="h-full rounded-full" style={{ width: `${Math.max(3, skill.strength.score)}%`, background: STATUS_COLOR[skill.strength.status] }} />
                </div>
                <span className="tabular text-[11px]" style={{ color: STATUS_COLOR[skill.strength.status] }}>
                  {STATUS_LABEL[skill.strength.status]} · {skill.strength.score}
                </span>
              </div>
              <div className="mt-1.5 text-xs text-muted">{reason}</div>
            </button>
          ))}
        </div>
      )}
    </Card>
  )
}
