import { ArrowDownRight, ArrowRight, ArrowUpRight, Table2 } from 'lucide-react'
import { useMemo } from 'react'
import { Badge, Card, CardHeader, EmptyState } from '@/components/ui'
import { fmtNet } from '@/lib/exam'
import { subjectAverages } from '@/lib/stats'
import type { ExamResult, ExamType } from '../../../../shared/types'
import type { SubjectMistakeStat } from './derive'
import { heatBg, heatText, InfoTip } from './parts'

interface Row {
  id: string
  name: string
  color: string
  exam: ExamType
  avgNet: number
  questionCount: number
  ratio: number
  accuracy: number
  trend: number
  count: number
  share: number
  mistakes: number
}

export function SubjectTable({
  exams,
  types,
  subjStats
}: {
  exams: ExamResult[]
  types: ExamType[]
  subjStats: SubjectMistakeStat[]
}): React.JSX.Element {
  const rows = useMemo<Row[]>(() => {
    const totalMistakes = subjStats.reduce((a, s) => a + s.mistakes, 0)
    const out: Row[] = []
    for (const t of types) {
      for (const a of subjectAverages(exams, t, 5)) {
        const mistakes = subjStats.find((s) => s.subject.id === a.subject.id)?.mistakes ?? 0
        out.push({
          id: a.subject.id,
          name: a.subject.name,
          color: a.subject.color,
          exam: t,
          avgNet: a.avgNet,
          questionCount: a.subject.questionCount,
          ratio: a.avgNet / a.subject.questionCount,
          accuracy: a.accuracy,
          trend: a.trend,
          count: a.count,
          share: totalMistakes ? mistakes / totalMistakes : 0,
          mistakes
        })
      }
    }
    return out.sort((a, b) => a.ratio - b.ratio)
  }, [exams, types, subjStats])

  const maxShare = Math.max(0.0001, ...rows.map((r) => r.share))

  return (
    <Card>
      <CardHeader
        icon={<Table2 size={16} />}
        title="Ders performansı"
        subtitle="Son 5 denemeye göre, en zayıftan en güçlüye"
        action={
          <InfoTip width={300}>
            Isı hücreleri; ortalama netin ders soru sayısına oranını ve doğruluk yüzdesini gösterir. Kırmızı zayıf, yeşil güçlü
            demektir. Trend, son 5 denemenin ortalamasının önceki 5 denemeye göre farkıdır.
          </InfoTip>
        }
      />
      {rows.length === 0 ? (
        <EmptyState title="Ders verisi yok" description="Seçili filtrede deneme sonucu bulunamadı." />
      ) : (
        <div className="overflow-x-auto px-3 pb-3 pt-2">
          <table className="w-full min-w-[640px] border-separate border-spacing-y-1 text-sm">
            <thead>
              <tr className="text-left text-[11px] font-medium uppercase tracking-wide text-subtle">
                <th className="px-3 py-1.5">Ders</th>
                <th className="px-3 py-1.5">Ort. net / soru</th>
                <th className="px-3 py-1.5">Başarı</th>
                <th className="px-3 py-1.5">Trend</th>
                <th className="w-[26%] px-3 py-1.5">Hata payı</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const trendUp = r.trend > 0.05
                const trendDown = r.trend < -0.05
                return (
                  <tr key={r.id} className="group">
                    <td className="rounded-l-lg bg-surface-2/40 px-3 py-2 transition group-hover:bg-surface-2">
                      <div className="flex items-center gap-2">
                        <span className="h-6 w-1 rounded-full" style={{ background: r.color }} />
                        <span className="font-medium text-text">{r.name}</span>
                        <Badge>{r.exam}</Badge>
                      </div>
                    </td>
                    <td className="px-1 py-1">
                      <div
                        className="tabular rounded-lg px-3 py-1.5 font-semibold"
                        style={{ background: heatBg(r.ratio), color: heatText(r.ratio) }}
                      >
                        {fmtNet(r.avgNet)}
                        <span className="font-normal text-subtle"> / {r.questionCount}</span>
                      </div>
                    </td>
                    <td className="px-1 py-1">
                      <div
                        className="tabular rounded-lg px-3 py-1.5 font-semibold"
                        style={{ background: heatBg(r.accuracy), color: heatText(r.accuracy) }}
                      >
                        %{Math.round(r.accuracy * 100)}
                      </div>
                    </td>
                    <td className="bg-surface-2/40 px-3 py-2 transition group-hover:bg-surface-2">
                      <span
                        className={`tabular inline-flex items-center gap-1 text-xs font-semibold ${
                          trendUp ? 'text-success' : trendDown ? 'text-danger' : 'text-subtle'
                        }`}
                      >
                        {trendUp ? <ArrowUpRight size={14} /> : trendDown ? <ArrowDownRight size={14} /> : <ArrowRight size={14} />}
                        {r.trend > 0 ? '+' : ''}
                        {fmtNet(r.trend)}
                      </span>
                    </td>
                    <td className="rounded-r-lg bg-surface-2/40 px-3 py-2 transition group-hover:bg-surface-2">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${(r.share / maxShare) * 100}%`, background: r.color }}
                          />
                        </div>
                        <span className="tabular w-16 text-right text-xs text-muted">
                          %{Math.round(r.share * 100)} · {r.mistakes}
                        </span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
