import { Target } from 'lucide-react'
import { Badge, Card, CardHeader } from '@/components/ui'
import { SUBJECT_MAP } from '@/data/curriculum'
import type { practiceAccuracy } from './derive'

export function PracticeAccuracy({
  items
}: {
  items: ReturnType<typeof practiceAccuracy>
}): React.JSX.Element {
  const list = items.slice(0, 8)
  return (
    <Card>
      <CardHeader icon={<Target size={16} />} title="Pratik doğruluğu" subtitle="Soru çözümünde en düşük başarılı konular (en az 5 soru)" />
      {list.length === 0 ? (
        <p className="px-5 py-12 text-center text-xs leading-relaxed text-muted">
          Henüz yeterli soru çözümü yok. Çalışma Takibi’nde konu seçip çözdüğün soru sayılarını girersen burada konu bazlı
          doğruluğun görünür.
        </p>
      ) : (
        <ul className="space-y-3 px-5 pb-5 pt-4">
          {list.map((it) => {
            const s = SUBJECT_MAP[it.subjectId]
            const bad = it.accuracy < 0.5
            const mid = it.accuracy < 0.7
            const col = bad ? 'rgb(var(--danger))' : mid ? 'rgb(var(--warning))' : 'rgb(var(--success))'
            return (
              <li key={it.topicId}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-[13px] font-medium text-text">{it.name}</span>
                    {s && <Badge color={s.color}>{s.short}</Badge>}
                  </div>
                  <span className="tabular shrink-0 text-xs text-muted">
                    <span className="font-semibold" style={{ color: col }}>
                      %{Math.round(it.accuracy * 100)}
                    </span>{' '}
                    · {it.solved} soru
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                  <div className="h-full rounded-full" style={{ width: `${it.accuracy * 100}%`, background: col }} />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
