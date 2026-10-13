import { ArrowRight, BookmarkPlus, ListOrdered } from 'lucide-react'
import { Badge, Button, Card, CardHeader, EmptyState, ProgressBar } from '@/components/ui'
import { SUBJECT_MAP } from '@/data/curriculum'
import { MISTAKE_KIND_COLOR, MISTAKE_KIND_LABEL } from '@/lib/exam'
import { useNav } from '@/lib/nav'
import type { TopicWeakness } from '@/lib/stats'
import type { TopicProgress } from '../../../../shared/types'
import { dominantKind, STATUS_COLOR, STATUS_LABEL } from './derive'
import { InfoTip } from './parts'

function Chip({ children, tone }: { children: React.ReactNode; tone?: 'danger' | 'warning' | 'info' }): React.JSX.Element {
  const cls =
    tone === 'danger'
      ? 'bg-danger/10 text-danger'
      : tone === 'warning'
        ? 'bg-warning/10 text-warning'
        : tone === 'info'
          ? 'bg-info/10 text-info'
          : 'bg-surface-3 text-muted'
  return <span className={`tabular inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ${cls}`}>{children}</span>
}

export function PriorityList({
  weak,
  progress,
  limit = 15
}: {
  weak: TopicWeakness[]
  progress: Record<string, TopicProgress>
  limit?: number
}): React.JSX.Element {
  const go = useNav((s) => s.go)
  const list = weak.slice(0, limit)
  const max = list[0]?.score || 1

  return (
    <Card className="flex flex-col">
      <CardHeader
        icon={<ListOrdered size={16} />}
        title="Öncelikli konular"
        subtitle="Önce hangi konulara dönmelisin?"
        action={
          <InfoTip width={320}>
            <div className="mb-1 font-semibold text-text">Öncelik puanı nasıl hesaplanır?</div>
            Deneme hata kayıtların, hata defterindeki açık notlar ve soru çözümlerindeki yanlış oranı birleştirilir.
            <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
              <li>Son denemeler daha çok ağırlık taşır (yaklaşık 60 günde etkisi %63 azalır).</li>
              <li>Bilgi eksiği kaynaklı yanlışlar %30 daha ağır sayılır.</li>
              <li>Hiç çalışılmamış konular öne çıkar, pekişmiş konuların puanı düşer.</li>
            </ul>
          </InfoTip>
        }
      />
      {list.length === 0 ? (
        <EmptyState
          title="Bu filtrede öncelikli konu yok"
          description="Seçili dönem ve sınav türünde konu bazlı hata kaydı bulunamadı. Filtreyi genişletmeyi dene."
        />
      ) : (
        <ol className="mt-2 divide-y divide-border/70 px-2 pb-2">
          {list.map((w, i) => {
            const subject = SUBJECT_MAP[w.subjectId]
            const color = subject?.color ?? '#7b838f'
            const dom = dominantKind(w.kinds)
            const status = progress[w.topicId]?.status ?? 0
            const practiceRate = w.practiceSolved >= 5 ? w.practiceWrong / w.practiceSolved : null
            return (
              <li key={w.topicId} className="group rounded-xl px-3 py-3 transition hover:bg-surface-2/60">
                <div className="flex items-start gap-3">
                  <div
                    className="tabular mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold"
                    style={{
                      background: i < 3 ? 'rgb(var(--danger) / 0.12)' : 'rgb(var(--surface-3))',
                      color: i < 3 ? 'rgb(var(--danger))' : 'rgb(var(--muted))'
                    }}
                  >
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-sm font-semibold text-text">{w.topicName}</span>
                      <Badge color={color}>{subject?.name ?? w.subjectName}</Badge>
                      <Badge color={STATUS_COLOR[status]}>{STATUS_LABEL[status]}</Badge>
                      {dom && <Badge color={MISTAKE_KIND_COLOR[dom]}>{MISTAKE_KIND_LABEL[dom]}</Badge>}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <div className="flex items-center gap-2">
                        <ProgressBar
                          value={w.score / max}
                          height={6}
                          color={`linear-gradient(90deg, ${color}99, ${color})`}
                          className="w-[120px]"
                        />
                        <span className="tabular text-xs font-semibold text-text">
                          {w.score.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {w.examMistakes > 0 && <Chip tone="danger">{w.examMistakes} deneme yanlışı</Chip>}
                        {w.openNotes > 0 && <Chip tone="warning">{w.openNotes} açık not</Chip>}
                        {practiceRate !== null && (
                          <Chip tone={practiceRate > 0.3 ? 'danger' : 'info'}>
                            pratik hata %{Math.round(practiceRate * 100)} ({w.practiceSolved} soru)
                          </Chip>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      icon={<ArrowRight size={13} />}
                      onClick={() => go('topics', { subject: w.subjectId, exam: w.subjectId.startsWith('ayt') ? 'AYT' : 'TYT' })}
                    >
                      Konuya git
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="px-2"
                      title="Hata defterine ekle"
                      aria-label="Hata defterine ekle"
                      icon={<BookmarkPlus size={13} />}
                      onClick={() => go('mistakes', { new: true, subject: w.subjectId, topic: w.topicId })}
                    >
                      <span className="hidden 2xl:inline">Hata defterine ekle</span>
                    </Button>
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </Card>
  )
}
