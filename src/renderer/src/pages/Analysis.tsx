import { AlertOctagon, ClipboardList, FileSpreadsheet, Flame, Plus, Sparkles, Trophy } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button, Card, EmptyState, PageHeader, Segmented, StatCard } from '@/components/ui'
import { InsightsCard } from '@/components/analysis/Insights'
import { KindDonut } from '@/components/analysis/KindDonut'
import { MistakeTreemap } from '@/components/analysis/MistakeTreemap'
import { PracticeAccuracy } from '@/components/analysis/PracticeAccuracy'
import { PriorityList } from '@/components/analysis/PriorityList'
import { SubjectTable } from '@/components/analysis/SubjectTable'
import { TrendGrid } from '@/components/analysis/TrendGrid'
import { WrongBlank } from '@/components/analysis/WrongBlank'
import {
  buildInsights,
  dominantKind,
  filterData,
  kindTotals,
  KINDS,
  practiceAccuracy,
  subjectMistakeStats,
  topicMistakeStats,
  type Period,
  type TypeFilter
} from '@/components/analysis/derive'
import { MISTAKE_KIND_COLOR, MISTAKE_KIND_LABEL } from '@/lib/exam'
import { useNav } from '@/lib/nav'
import { useStore } from '@/lib/store'
import { subjectAverages, topicWeaknesses } from '@/lib/stats'
import type { ExamType } from '../../../shared/types'

export default function Analysis(): React.JSX.Element {
  const data = useStore((s) => s.data)
  const go = useNav((s) => s.go)
  const [type, setType] = useState<TypeFilter>('ALL')
  const [period, setPeriod] = useState<Period>('90')

  const hasMistakeData = useMemo(() => data.exams.some((e) => (e.mistakes?.length ?? 0) > 0), [data.exams])

  const fdata = useMemo(() => filterData(data, type, period), [data, type, period])
  const types = useMemo<ExamType[]>(() => (type === 'ALL' ? ['TYT', 'AYT'] : [type]), [type])

  const weak = useMemo(() => topicWeaknesses(fdata), [fdata])
  const kinds = useMemo(() => kindTotals(fdata.exams), [fdata.exams])
  const subjStats = useMemo(() => subjectMistakeStats(fdata.exams), [fdata.exams])
  const topicStats = useMemo(() => topicMistakeStats(fdata.exams), [fdata.exams])
  const practice = useMemo(() => practiceAccuracy(fdata, 5), [fdata])
  const insights = useMemo(
    () => buildInsights({ fdata, weak, kinds, subjStats, topicStats, practice }),
    [fdata, weak, kinds, subjStats, topicStats, practice]
  )

  const totalMistakes = KINDS.reduce((a, k) => a + kinds[k], 0)
  const dom = dominantKind(kinds)
  const weakestSubject = useMemo(() => {
    const rows = types.flatMap((t) => subjectAverages(fdata.exams, t, 5))
    return rows.sort((a, b) => a.avgNet / a.subject.questionCount - b.avgNet / b.subject.questionCount)[0]
  }, [fdata.exams, types])

  const header = (
    <PageHeader
      title="Hata Analizi"
      description="Hangi konularda, neden ve ne sıklıkla yanlış yaptığını gör; çalışmanı en çok net getirecek yere yönlendir."
    />
  )

  if (!hasMistakeData) {
    return (
      <div>
        {header}
        <Card>
          <EmptyState
            className="py-20"
            icon={<FileSpreadsheet size={22} />}
            title="Analiz için hata verisi gerekiyor"
            description="Bu sayfa, deneme girerken işaretlediğin yanlış / boş konulardan beslenir. Deneme formunda “Hatalı konular” bölümüne hangi dersin hangi konusundan kaç soru kaçırdığını ve nedenini (bilgi eksiği, dikkat, süre…) eklediğinde öncelikli konular, hata türü dağılımı ve içgörüler burada oluşur."
            action={
              <Button variant="primary" icon={<Plus size={15} />} onClick={() => go('exams', { new: true })}>
                Deneme ekle
              </Button>
            }
          />
        </Card>
      </div>
    )
  }

  const noFiltered = fdata.exams.length === 0

  return (
    <div>
      <PageHeader
        title="Hata Analizi"
        description="Hangi konularda, neden ve ne sıklıkla yanlış yaptığını gör; çalışmanı en çok net getirecek yere yönlendir."
        actions={
          <>
            <Segmented
              size="sm"
              value={type}
              onChange={setType}
              options={[
                { value: 'ALL', label: 'Tümü' },
                { value: 'TYT', label: 'TYT' },
                { value: 'AYT', label: 'AYT' }
              ]}
            />
            <Segmented
              size="sm"
              value={period}
              onChange={setPeriod}
              options={[
                { value: '30', label: 'Son 30 gün' },
                { value: '90', label: 'Son 90 gün' },
                { value: 'all', label: 'Tümü' }
              ]}
            />
          </>
        }
      />

      {noFiltered && (
        <Card className="mb-5 border-warning/30 bg-warning/5">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <p className="text-sm text-muted">
              Seçili filtrede deneme bulunamadı. Dönemi genişletmeyi veya sınav türünü “Tümü” yapmayı dene.
            </p>
            <Button size="sm" variant="outline" onClick={() => { setType('ALL'); setPeriod('all') }}>
              Filtreleri sıfırla
            </Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Analiz edilen deneme"
          value={fdata.exams.length}
          sub={`${fdata.exams.filter((e) => (e.mistakes?.length ?? 0) > 0).length} tanesinde konu bazlı hata var`}
          icon={<ClipboardList size={14} />}
        />
        <StatCard
          label="Kayıtlı hatalı soru"
          value={totalMistakes}
          sub={`${weak.length} farklı konuda`}
          icon={<AlertOctagon size={14} />}
          accent="rgb(var(--danger))"
        />
        <StatCard
          label="Baskın hata türü"
          value={dom ? MISTAKE_KIND_LABEL[dom] : '—'}
          sub={dom && totalMistakes ? `Hataların %${Math.round((kinds[dom] / totalMistakes) * 100)}’i` : 'Veri yok'}
          icon={<Flame size={14} />}
          accent={dom ? MISTAKE_KIND_COLOR[dom] : 'rgb(var(--muted))'}
        />
        <StatCard
          label="En zayıf ders"
          value={weakestSubject ? weakestSubject.subject.name : '—'}
          sub={
            weakestSubject
              ? `Ort. ${weakestSubject.avgNet.toLocaleString('tr-TR')} net / ${weakestSubject.subject.questionCount} soru`
              : 'Veri yok'
          }
          icon={<Trophy size={14} />}
          accent={weakestSubject?.subject.color ?? 'rgb(var(--muted))'}
        />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <PriorityList weak={weak} progress={data.topicProgress} limit={15} />
        </div>
        <div className="flex flex-col gap-5 xl:col-span-5">
          <InsightsCard insights={insights} />
          <KindDonut kinds={kinds} />
        </div>
      </div>

      <div className="mt-5">
        <SubjectTable exams={fdata.exams} types={types} subjStats={subjStats} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <MistakeTreemap topics={topicStats} />
        </div>
        <div className="xl:col-span-5">
          <WrongBlank stats={subjStats} />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <TrendGrid exams={fdata.exams} types={types} />
        </div>
        <div className="xl:col-span-5">
          <PracticeAccuracy items={practice} />
        </div>
      </div>

      <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-[11px] text-subtle">
        <Sparkles size={12} /> Analiz yalnızca girdiğin verilere dayanır; daha çok deneme ve hata kaydı daha isabetli sonuç verir.
      </p>
    </div>
  )
}
