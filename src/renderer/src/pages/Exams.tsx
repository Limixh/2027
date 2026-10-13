import {
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  Gauge,
  Minus,
  Pencil,
  Plus,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Trophy,
  ClipboardList,
  FileText
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { ExamResult, ExamType } from '../../../shared/types'
import ExamDetail from '@/components/exams/ExamDetail'
import ExamForm from '@/components/exams/ExamForm'
import TrendChart from '@/components/exams/TrendChart'
import { TYT_GROUP_META, estimateFor, examSubjects, signed, typeStats } from '@/components/exams/helpers'
import { Badge, Button, Card, Dot, EmptyState, PageHeader, Segmented, StatCard, cn, confirm, toast } from '@/components/ui'
import { formatDate, formatMinutes } from '@/lib/date'
import { fmtNet, net, round2, totalNet, totals, tytGroupNets } from '@/lib/exam'
import { useNav } from '@/lib/nav'
import { sortedExams } from '@/lib/stats'
import { useStore } from '@/lib/store'

type FormState = { exam?: ExamResult } | null

function DeltaBadge({ value }: { value: number | null }): React.JSX.Element {
  if (value === null) return <span className="text-[11px] text-subtle">ilk deneme</span>
  const up = value > 0.004
  const down = value < -0.004
  return (
    <span
      className={cn(
        'tabular inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold',
        up ? 'bg-success/10 text-success' : down ? 'bg-danger/10 text-danger' : 'bg-surface-2 text-subtle'
      )}
      title="Bir önceki aynı türdeki denemeye göre değişim"
    >
      {up ? <ArrowUpRight size={13} /> : down ? <ArrowDownRight size={13} /> : <Minus size={13} />}
      {signed(value, fmtNet)}
    </span>
  )
}

export default function Exams(): React.JSX.Element {
  const exams = useStore((s) => s.data.exams)
  const settings = useStore((s) => s.data.settings)
  const deleteExam = useStore((s) => s.deleteExam)
  const params = useNav((s) => s.params)

  const [type, setType] = useState<ExamType>(() => {
    const latest = sortedExams(useStore.getState().data.exams).pop()
    return latest?.type ?? 'TYT'
  })
  const [form, setForm] = useState<FormState>(null)
  const [detailId, setDetailId] = useState<string | null>(null)

  // Sayfaya parametreyle gelme: { new: true } veya { examId }
  useEffect(() => {
    if (params.new) setForm({})
    if (typeof params.examId === 'string') {
      const e = useStore.getState().data.exams.find((x) => x.id === params.examId)
      if (e) {
        setType(e.type)
        setDetailId(e.id)
      }
    }
  }, [params])

  const list = useMemo(() => sortedExams(exams, type), [exams, type])
  const listDesc = useMemo(() => list.slice().reverse(), [list])
  const stats = useMemo(() => typeStats(exams, type), [exams, type])
  const target = type === 'TYT' ? settings.targetTytNet : settings.targetAytNet
  const counts = useMemo(
    () => ({ TYT: exams.filter((e) => e.type === 'TYT').length, AYT: exams.filter((e) => e.type === 'AYT').length }),
    [exams]
  )
  const detailExam = detailId ? exams.find((e) => e.id === detailId) : undefined

  const remove = async (e: ExamResult): Promise<void> => {
    const ok = await confirm({
      title: 'Deneme silinsin mi?',
      message: `“${e.name}” (${formatDate(e.date)}) ve konu analizi kalıcı olarak silinecek.`,
      confirmText: 'Sil'
    })
    if (!ok) return
    deleteExam(e.id)
    if (detailId === e.id) setDetailId(null)
    toast('Deneme silindi', 'info')
  }

  const header = (
    <PageHeader
      title="Denemeler"
      description="Deneme sonuçlarını kaydet, net gelişimini ve zayıf konularını takip et."
      actions={
        <>
          <Segmented<ExamType>
            value={type}
            onChange={setType}
            options={[
              { value: 'TYT', label: `TYT${counts.TYT ? ` · ${counts.TYT}` : ''}` },
              { value: 'AYT', label: `AYT${counts.AYT ? ` · ${counts.AYT}` : ''}` }
            ]}
          />
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setForm({})}>
            Deneme ekle
          </Button>
        </>
      }
    />
  )

  const modals = (
    <>
      {form && (
        <ExamForm
          key={form.exam?.id ?? 'new'}
          exam={form.exam}
          defaultType={type}
          onClose={() => setForm(null)}
          onSaved={(e) => {
            setForm(null)
            setType(e.type)
          }}
        />
      )}
      {detailExam && (
        <ExamDetail
          exam={detailExam}
          onClose={() => setDetailId(null)}
          onEdit={() => {
            setForm({ exam: detailExam })
            setDetailId(null)
          }}
          onDelete={() => void remove(detailExam)}
        />
      )}
    </>
  )

  if (exams.length === 0) {
    return (
      <div>
        {header}
        <Card>
          <EmptyState
            className="py-20"
            icon={<ClipboardList size={22} />}
            title="Henüz deneme eklemedin"
            description="İlk TYT veya AYT denemeni ekle: doğru/yanlış/boş sayılarını gir, yanlış yaptığın konuları işaretle; net gelişimin ve zayıf konuların burada görünsün."
            action={
              <Button variant="primary" size="lg" icon={<Plus size={16} />} onClick={() => setForm({})}>
                İlk denemeni ekle
              </Button>
            }
          />
        </Card>
        {modals}
      </div>
    )
  }

  const trend = stats.trend

  return (
    <div>
      {header}

      {list.length === 0 ? (
        <Card>
          <EmptyState
            className="py-16"
            icon={<FileText size={22} />}
            title={`Henüz ${type} denemesi yok`}
            description={`${type} denemelerini ekledikçe net grafiği ve istatistikler burada oluşacak.`}
            action={
              <Button variant="primary" icon={<Plus size={16} />} onClick={() => setForm({})}>
                {type} denemesi ekle
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <StatCard label="Deneme sayısı" value={stats.count} sub={`${type} denemesi`} icon={<ClipboardList size={15} />} />
            <StatCard
              label="Ortalama net"
              value={fmtNet(stats.avg)}
              sub={target > 0 ? `Hedefe ${fmtNet(round2(Math.max(0, target - stats.avg)))} net kaldı` : undefined}
              icon={<Gauge size={15} />}
              accent="rgb(var(--info))"
            />
            <StatCard
              label="En yüksek net"
              value={fmtNet(stats.bestNet)}
              sub={stats.best ? <span className="block truncate">{stats.best.name}</span> : undefined}
              icon={<Trophy size={15} />}
              accent="rgb(var(--warning))"
            />
            <StatCard
              label="Son 5 ortalaması"
              value={fmtNet(stats.last5)}
              sub={target > 0 ? `Hedef ${fmtNet(target)}` : undefined}
              icon={<Target size={15} />}
              accent="rgb(var(--accent-2))"
            />
            <StatCard
              label="Trend"
              value={
                trend === null ? (
                  '–'
                ) : (
                  <span className={cn(trend > 0.004 ? 'text-success' : trend < -0.004 ? 'text-danger' : 'text-text')}>
                    {signed(trend, fmtNet)}
                  </span>
                )
              }
              sub={stats.trendHint}
              icon={trend !== null && trend < 0 ? <TrendingDown size={15} /> : <TrendingUp size={15} />}
              accent={trend !== null && trend < 0 ? 'rgb(var(--danger))' : 'rgb(var(--success))'}
            />
          </div>

          <TrendChart key={type} exams={exams} type={type} target={target} />

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                {type} denemeleri <span className="ml-1 font-normal text-muted">· en yeni üstte</span>
              </h2>
            </div>
            <div className="space-y-3">
              {listDesc.map((e) => {
                const idx = list.findIndex((x) => x.id === e.id)
                const prev = idx > 0 ? list[idx - 1] : null
                return (
                  <ExamCard
                    key={e.id}
                    exam={e}
                    delta={prev ? round2(totalNet(e) - totalNet(prev)) : null}
                    onOpen={() => setDetailId(e.id)}
                    onEdit={() => setForm({ exam: e })}
                    onDelete={() => void remove(e)}
                  />
                )
              })}
            </div>
          </div>
        </div>
      )}
      {modals}
    </div>
  )
}

function ExamCard({
  exam,
  delta,
  onOpen,
  onEdit,
  onDelete
}: {
  exam: ExamResult
  delta: number | null
  onOpen: () => void
  onEdit: () => void
  onDelete: () => void
}): React.JSX.Element {
  const exams = useStore((s) => s.data.exams)
  const settings = useStore((s) => s.data.settings)
  const t = totals(exam)
  const est = useMemo(() => estimateFor(exam, exams, settings), [exam, exams, settings])
  const mistakeCount = exam.mistakes.reduce((a, m) => a + m.count, 0)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(ev) => {
        if (ev.key === 'Enter' && ev.target === ev.currentTarget) onOpen()
      }}
      className="card group cursor-pointer p-4 transition-all duration-150 hover:-translate-y-px hover:border-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1 basis-56">
          <div className="flex items-center gap-2">
            <Badge color={exam.type === 'TYT' ? '#6366f1' : '#ec4899'}>{exam.type}</Badge>
            <h3 className="truncate text-[15px] font-semibold">{exam.name}</h3>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
            <span>{formatDate(exam.date)}</span>
            {exam.durationMin ? (
              <span className="inline-flex items-center gap-1">
                <Clock size={11} /> {formatMinutes(exam.durationMin)}
              </span>
            ) : null}
            {mistakeCount > 0 && <span>{mistakeCount} soru analiz edildi</span>}
          </div>
        </div>

        <div className="flex items-center gap-6">
          {est && (
            <div className="hidden text-right md:block" title={`${est.label}: ham ${fmtNet(est.raw)} · yerleştirme ${fmtNet(est.place)}`}>
              <div className="text-[10px] font-medium uppercase tracking-wide text-subtle">≈ tahmini {est.label.toLocaleLowerCase('tr-TR')}</div>
              <div className="tabular text-sm font-semibold">{fmtNet(est.raw)}</div>
              <div className="tabular text-[11px] text-muted">yerleştirme ≈ {fmtNet(est.place)}</div>
            </div>
          )}
          <div className="flex items-center gap-3 text-xs">
            <Stat label="D" value={t.correct} className="text-success" />
            <Stat label="Y" value={t.wrong} className="text-danger" />
            <Stat label="B" value={t.blank} className="text-muted" />
          </div>
          <div className="min-w-[88px] text-right">
            <div className="tabular text-3xl font-semibold leading-none tracking-tight">{fmtNet(t.net)}</div>
            <div className="mt-1.5 flex justify-end">
              <DeltaBadge value={delta} />
            </div>
          </div>
          <div className="flex flex-col gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            <button
              type="button"
              aria-label="Düzenle"
              onClick={(ev) => {
                ev.stopPropagation()
                onEdit()
              }}
              className="grid h-7 w-7 place-items-center rounded-md text-subtle hover:bg-surface-2 hover:text-text"
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              aria-label="Sil"
              onClick={(ev) => {
                ev.stopPropagation()
                onDelete()
              }}
              className="grid h-7 w-7 place-items-center rounded-md text-subtle hover:bg-danger/10 hover:text-danger"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 border-t border-border/70 pt-3">
        {exam.type === 'TYT'
          ? (() => {
              const g = tytGroupNets(exam)
              return TYT_GROUP_META.map((m) => (
                <Chip key={m.key} color={m.color} label={m.label} value={g[m.key]} />
              ))
            })()
          : examSubjects(exam).map((s) => (
              <Chip key={s.id} color={s.color} label={s.short} value={round2(net(exam.scores[s.id]))} />
            ))}
      </div>
    </div>
  )
}

function Stat({ label, value, className }: { label: string; value: number; className?: string }): React.JSX.Element {
  return (
    <div className="text-center">
      <div className={cn('tabular text-sm font-semibold', className)}>{value}</div>
      <div className="text-[10px] text-subtle">{label}</div>
    </div>
  )
}

function Chip({ color, label, value }: { color: string; label: string; value: number }): React.JSX.Element {
  return (
    <span className="inline-flex items-center gap-2 rounded-lg bg-surface-2 px-2.5 py-1 text-xs">
      <Dot color={color} size={7} />
      <span className="text-muted">{label}</span>
      <b className="tabular text-text">{fmtNet(value)}</b>
    </span>
  )
}
