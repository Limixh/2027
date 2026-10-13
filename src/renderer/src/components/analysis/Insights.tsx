import { AlertTriangle, Lightbulb, Sparkles, TrendingUp } from 'lucide-react'
import { Button, Card, CardHeader } from '@/components/ui'
import { useNav } from '@/lib/nav'
import type { Insight } from './derive'

const TONE = {
  warn: { icon: AlertTriangle, cls: 'bg-warning/10 text-warning' },
  info: { icon: Lightbulb, cls: 'bg-info/10 text-info' },
  good: { icon: TrendingUp, cls: 'bg-success/10 text-success' }
} as const

export function InsightsCard({ insights }: { insights: Insight[] }): React.JSX.Element {
  const go = useNav((s) => s.go)
  return (
    <Card className="relative overflow-hidden">
      <CardHeader icon={<Sparkles size={16} />} title="Otomatik içgörüler" subtitle="Verilerinden çıkan öne çıkanlar" />
      <div className="space-y-2.5 px-5 pb-5 pt-3">
        {insights.length === 0 ? (
          <p className="text-xs leading-relaxed text-muted">
            İçgörü üretmek için daha fazla deneme ve hata kaydı gerekiyor. Deneme girerken yanlış yaptığın konuları da
            işaretle.
          </p>
        ) : (
          insights.map((ins, i) => {
            const { icon: Icon, cls } = TONE[ins.tone]
            return (
              <div key={i} className="flex items-start gap-2.5">
                <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md ${cls}`}>
                  <Icon size={13} />
                </span>
                <p className="text-[13px] leading-relaxed text-text">{ins.text}</p>
              </div>
            )
          })
        )}
        <Button
          variant="primary"
          className="mt-2 w-full"
          icon={<Sparkles size={14} />}
          onClick={() => go('ai', { prompt: 'analiz' })}
        >
          AI Koç ile detaylı analiz
        </Button>
      </div>
    </Card>
  )
}
