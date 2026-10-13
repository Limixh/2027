import {
  ArrowRight,
  Bot,
  BookOpenCheck,
  CalendarClock,
  Check,
  ClipboardList,
  Flame,
  Info,
  Plus,
  RefreshCcw,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy
} from 'lucide-react'
import { useMemo } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Heatmap } from '@/components/Heatmap'
import { subjectColor } from '@/components/study/meta'
import { Badge, Button, Card, CardHeader, Dot, EmptyState, PageHeader, ProgressBar, Segmented, StatCard, cn } from '@/components/ui'
import { CURRICULUM_NOTE, SUBJECT_MAP, TOPIC_MAP, subjectsFor } from '@/data/curriculum'
import { addDays, formatDate, formatHours, formatMinutes, formatShort, todayKey, weekdayName } from '@/lib/date'
import { estimateField, estimateTyt, FIELD_LABEL, fmtNet, placement, totalNet, tytGroupNets } from '@/lib/exam'
import { useNav } from '@/lib/nav'
import {
  currentStreak,
  daysUntil,
  examSeries,
  minutesByDay,
  overallProgress,
  reviewsDue,
  sortedExams,
  subjectProgress,
  thisWeekMinutes,
  topicWeaknesses
} from '@/lib/stats'
import { useStore } from '@/lib/store'
import { useState } from 'react'

const DEFAULT_EXAM_DATE = '2027-06-19'
const tick = { fill: 'rgb(var(--subtle))', fontSize: 10 }

/* ------------------------------------------------------------------ */
/* Küçük net trend grafiği                                             */
/* ------------------------------------------------------------------ */

function NetTrend({
  title,
  rows,
  target,
  color,
  onAdd
}: {
  title: string
  rows: Record<string, number | string>[]
  target: number
  color: string
  onAdd: () => void
}): React.JSX.Element {
  const data = rows.slice(-10)
  const last = data.length ? (data[data.length - 1].total as number) : undefined
  const prev = data.length > 1 ? (data[data.length - 2].total as number) : undefined
  const delta = last !== undefined && prev !== undefined ? last - prev : undefined
  return (
    <div className="min-w-0">
      <div className="flex items-end justify-between gap-2 px-1">
        <div>
          <div className="text-xs font-medium text-muted">{title} net</div>
          <div className="tabular flex items-baseline gap-2">
            <span className="text-xl font-semibold" style={{ color: last !== undefined ? color : undefined }}>
              {last !== undefined ? fmtNet(last) : '—'}
            </span>
            <span className="text-xs text-subtle">/ hedef {fmtNet(target)}</span>
          </div>
        </div>
        {delta !== undefined && (
          <span className={cn('tabular inline-flex items-center gap-0.5 text-xs font-medium', delta >= 0 ? 'text-success' : 'text-danger')}>
            {delta >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            {delta >= 0 ? '+' : ''}
            {fmtNet(Math.round(delta * 100) / 100)}
          </span>
        )}
      </div>
      <div className="mt-2 h-[200px]">
        {data.length === 0 ? (
          <button
            onClick={onAdd}
            className="grid h-full w-full place-items-center rounded-xl border border-dashed border-border text-xs text-subtle transition hover:border-accent/50 hover:text-accent"
          >
            <span className="flex items-center gap-1.5">
              <Plus size={14} /> İlk {title} denemeni ekle
            </span>
          </button>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 6, right: 8, left: -22, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="rgb(var(--border))" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={tick} tickLine={false} axisLine={false} tickFormatter={(d: string) => formatShort(d)} interval="preserveStartEnd" minTickGap={24} />
              <YAxis tick={tick} tickLine={false} axisLine={false} domain={[0, (m: number) => Math.ceil(Math.max(m, target) / 10) * 10]} allowDecimals={false} />
              <ReferenceLine y={target} stroke="rgb(var(--success))" strokeDasharray="4 4" strokeOpacity={0.7} />
              <Tooltip
                cursor={{ stroke: 'rgb(var(--border))' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const r = payload[0].payload as Record<string, number | string>
                  return (
                    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-card">
                      <div className="font-semibold text-text">{r.name as string}</div>
                      <div className="text-muted">{formatDate(r.date as string)}</div>
                      <div className="tabular mt-0.5 text-text">{fmtNet(r.total as number)} net</div>
                    </div>
                  )
                }}
              />
              <Line type="monotone" dataKey="total" stroke={color} strokeWidth={2.5} dot={{ r: 3, fill: color, strokeWidth: 0 }} activeDot={{ r: 5 }} animationDuration={400} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Sayfa                                                               */
/* ------------------------------------------------------------------ */

export default function Dashboard(): React.JSX.Element {
  const data = useStore((s) => s.data)
  const markReviewed = useStore((s) => s.markReviewed)
  const go = useNav((s) => s.go)
  const { settings, sessions, exams } = data
  const [progressExam, setProgressExam] = useState<'TYT' | 'AYT'>('TYT')

  const today = todayKey()
  const goal = settings.dailyGoalMinutes

  const byDay = useMemo(() => minutesByDay(sessions), [sessions])
  const todayMin = byDay.get(today) ?? 0
  const week = useMemo(() => thisWeekMinutes(byDay), [byDay])
  const streak = useMemo(() => currentStreak(byDay), [byDay])

  const tytSeries = useMemo(() => examSeries(exams, 'TYT'), [exams])
  const aytSeries = useMemo(() => examSeries(exams, 'AYT'), [exams])
  const lastTyt = useMemo(() => sortedExams(exams, 'TYT').at(-1), [exams])
  const lastAyt = useMemo(() => sortedExams(exams, 'AYT').at(-1), [exams])
  const lastTytNet = lastTyt ? totalNet(lastTyt) : undefined
  const lastAytNet = lastAyt ? totalNet(lastAyt) : undefined

  const overall = useMemo(() => overallProgress(data), [data])
  const weak = useMemo(() => topicWeaknesses(data).slice(0, 5), [data])
  const due = useMemo(() => reviewsDue(data), [data])

  const left = daysUntil(settings.examDate)
  const tentative = settings.examDate === DEFAULT_EXAM_DATE
  const hoursIfGoal = Math.round((Math.max(0, left) * goal) / 60)

  const est = useMemo(() => {
    if (!lastTyt) return null
    const nets = tytGroupNets(lastTyt)
    const tyt = estimateTyt(nets)
    const field = settings.field === 'DIL' ? null : estimateField(settings.field, nets, lastAyt)
    return { tyt, field, tytPlace: placement(tyt, settings.obp), fieldPlace: field !== null ? placement(field, settings.obp) : null }
  }, [lastTyt, lastAyt, settings.field, settings.obp])

  const aytSubjects = useMemo(() => subjectsFor('AYT', settings.field), [settings.field])
  const progressSubjects = progressExam === 'TYT' ? subjectsFor('TYT') : aytSubjects

  const fresh = sessions.length === 0 && exams.length === 0 && Object.keys(data.topicProgress).length === 0
  const name = settings.name.trim()
  const todayPct = goal > 0 ? todayMin / goal : 0
  const weekdayLong = weekdayName(today)

  const netSub = (last: number | undefined, target: number): React.ReactNode =>
    last === undefined ? (
      <span>Hedef {fmtNet(target)} · henüz deneme yok</span>
    ) : (
      <span>
        Hedef {fmtNet(target)} ·{' '}
        <span className={last >= target ? 'text-success' : 'text-warning'}>
          {last >= target ? 'hedefte' : `${fmtNet(Math.round((target - last) * 100) / 100)} net eksik`}
        </span>
      </span>
    )

  return (
    <div>
      <PageHeader
        title={name ? `Merhaba, ${name}` : 'Merhaba!'}
        description={`${formatDate(today)}, ${weekdayLong} · ${
          todayMin > 0 ? `Bugün ${formatMinutes(todayMin)} çalıştın, devam!` : 'Bugün için ilk çalışmanı eklemeye ne dersin?'
        }`}
        actions={
          <>
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => go('study', { new: true })}>
              Çalışma ekle
            </Button>
            <Button variant="secondary" icon={<ClipboardList size={16} />} onClick={() => go('exams', { new: true })}>
              Deneme ekle
            </Button>
            <Button variant="secondary" icon={<Bot size={16} />} onClick={() => go('ai')}>
              AI Koç&apos;a sor
            </Button>
          </>
        }
      />

      {fresh && (
        <Card className="relative mb-4 overflow-hidden border-accent/30 bg-gradient-to-br from-accent/10 via-surface to-accent-2/10 p-5">
          <div className="flex flex-wrap items-center gap-5">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-accent to-accent-2 text-on-accent shadow-glow">
              <Sparkles size={22} />
            </div>
            <div className="min-w-[260px] flex-1">
              <h2 className="text-base font-semibold">YKS 2027 yolculuğuna hoş geldin!</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                Panelin dolması için üç küçük adım yeterli. Veriler yalnızca bu cihazda saklanır.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" icon={<Target size={15} />} onClick={() => go('settings')}>
                1 · Hedeflerini belirle
              </Button>
              <Button variant="outline" icon={<CalendarClock size={15} />} onClick={() => go('study', { new: true })}>
                2 · İlk çalışmanı ekle
              </Button>
              <Button variant="outline" icon={<ClipboardList size={15} />} onClick={() => go('exams', { new: true })}>
                3 · Bir deneme gir
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Geri sayım + KPI */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card className="relative flex flex-col justify-between overflow-hidden bg-gradient-to-br from-accent/15 via-surface to-accent-2/10 p-6 lg:col-span-4">
          <div className="relative">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted">
              <CalendarClock size={14} className="text-accent" /> YKS 2027&apos;ye
            </div>
            {left >= 0 ? (
              <>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="tabular bg-gradient-to-br from-accent to-accent-2 bg-clip-text text-6xl font-bold leading-none tracking-tight text-transparent">
                    {left}
                  </span>
                  <span className="text-lg font-medium text-muted">gün kaldı</span>
                </div>
                <div className="mt-2 text-sm text-muted">
                  Yaklaşık <span className="tabular font-semibold text-text">{Math.floor(left / 7)}</span> hafta
                  {left % 7 > 0 && (
                    <>
                      {' '}
                      <span className="tabular font-semibold text-text">{left % 7}</span> gün
                    </>
                  )}{' '}
                  · {formatDate(settings.examDate)}
                </div>
              </>
            ) : (
              <div className="mt-3 text-2xl font-semibold">Sınav tarihi geçti</div>
            )}
          </div>
          <div className="relative mt-5 space-y-2">
            {left > 0 && goal > 0 && (
              <div className="rounded-xl border border-border bg-surface/70 px-3 py-2 text-xs leading-relaxed text-muted">
                Her gün hedefine ulaşırsan sınava kadar yaklaşık{' '}
                <span className="tabular font-semibold text-text">{hoursIfGoal.toLocaleString('tr-TR')} saat</span> daha çalışmış olacaksın.
              </div>
            )}
            {tentative && (
              <div className="flex items-start gap-1.5 text-[11px] leading-relaxed text-subtle">
                <Info size={12} className="mt-0.5 shrink-0" />
                <span>
                  Sınav tarihi tahminidir (ÖSYM kesinleştirmedi).{' '}
                  <button className="text-accent hover:underline" onClick={() => go('settings')}>
                    Ayarlar&apos;dan güncelle
                  </button>
                </span>
              </div>
            )}
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:col-span-8">
          <StatCard
            label="Bugün"
            value={formatMinutes(todayMin)}
            icon={<Target size={14} />}
            accent={todayPct >= 1 ? 'rgb(var(--success))' : 'rgb(var(--accent))'}
            sub={
              <div className="mt-1.5 space-y-1.5">
                <ProgressBar value={todayPct} height={5} color={todayPct >= 1 ? 'rgb(var(--success))' : undefined} />
                <div>Hedef {formatHours(goal)}</div>
              </div>
            }
          />
          <StatCard label="Bu hafta" value={formatHours(week)} sub={`${formatMinutes(week)} · hedef ${formatHours(goal * 7, 0)}`} icon={<CalendarClock size={14} />} accent="rgb(var(--info))" />
          <StatCard
            label="Seri"
            value={
              <>
                {streak} <span className="text-sm font-medium text-muted">gün</span>
              </>
            }
            sub={streak > 0 ? 'Zinciri kırma!' : 'Bugün başla, seri oluştur'}
            icon={<Flame size={14} />}
            accent="rgb(var(--warning))"
          />
          <StatCard label="Son TYT neti" value={lastTytNet !== undefined ? fmtNet(lastTytNet) : '—'} sub={netSub(lastTytNet, settings.targetTytNet)} icon={<Trophy size={14} />} accent="rgb(var(--accent))" />
          <StatCard
            label="Son AYT neti"
            value={lastAytNet !== undefined ? fmtNet(lastAytNet) : '—'}
            sub={settings.field === 'DIL' ? 'Dil alanı: YDT ayrı takip edilir' : netSub(lastAytNet, settings.targetAytNet)}
            icon={<Trophy size={14} />}
            accent="rgb(var(--accent-2))"
          />
          <StatCard
            label="Konu ilerlemesi"
            value={`%${Math.round(overall.pct * 100)}`}
            sub={`${overall.done} / ${overall.total} konu bitti`}
            icon={<BookOpenCheck size={14} />}
            accent="rgb(var(--success))"
          />
        </div>
      </div>

      {/* Heatmap + tahmini puan */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-8">
          <CardHeader
            icon={<Flame size={16} />}
            title="Çalışma haritası"
            subtitle={`Son 26 hafta · günlük hedef ${formatHours(goal)}`}
            action={
              <Button variant="ghost" size="sm" onClick={() => go('study')} icon={<ArrowRight size={14} />}>
                Detay
              </Button>
            }
          />
          <div className="px-5 pb-4 pt-4">
            <Heatmap data={byDay} goal={goal} from={addDays(today, -7 * 26)} to={today} />
            {sessions.length === 0 && (
              <p className="mt-1 text-center text-xs text-subtle">Her çalışma bir kareyi renklendirir. İlk karen seni bekliyor.</p>
            )}
          </div>
        </Card>

        <Card className="flex flex-col lg:col-span-4">
          <CardHeader
            icon={<Target size={16} />}
            title="Tahmini puan"
            subtitle="Yaklaşık değerler · son denemelere göre"
            action={<Badge>yaklaşık</Badge>}
          />
          <div className="flex flex-1 flex-col justify-center px-5 pb-5 pt-4">
            {!est ? (
              <EmptyState
                className="py-6"
                icon={<Target size={20} />}
                title="Puan tahmini için TYT denemesi gir"
                description="Bir TYT ve (alanına göre) AYT denemesi eklediğinde yaklaşık puanını ve yerleştirme puanını burada göreceksin."
                action={
                  <Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={() => go('exams', { new: true })}>
                    Deneme ekle
                  </Button>
                }
              />
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">TYT puanı</span>
                  <span className="tabular text-xl font-semibold">~{fmtNet(Math.round(est.tyt * 10) / 10)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">{FIELD_LABEL[settings.field]} puanı</span>
                  <span className="tabular text-xl font-semibold">
                    {est.field !== null ? `~${fmtNet(Math.round(est.field * 10) / 10)}` : <span className="text-sm font-normal text-subtle">{settings.field === 'DIL' ? 'hesaplanmıyor' : 'AYT denemesi gerekli'}</span>}
                  </span>
                </div>
                <div className="rounded-xl bg-gradient-to-br from-accent/10 to-accent-2/10 p-3">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-muted">Yerleştirme puanı (OBP {fmtNet(settings.obp)})</div>
                  <div className="tabular mt-1 text-2xl font-bold">
                    ~{fmtNet(Math.round((est.fieldPlace ?? est.tytPlace) * 10) / 10)}
                  </div>
                  <div className="text-[11px] text-subtle">{est.fieldPlace !== null ? `${FIELD_LABEL[settings.field]} alanı` : 'TYT bazlı'}</div>
                </div>
                {settings.targetProgram && <div className="truncate text-xs text-muted">Hedef: {settings.targetProgram}</div>}
                <p className="text-[11px] leading-relaxed text-subtle">Katsayılar geçmiş yıllara dayalı tahminidir; gerçek puan sınav zorluğuna göre değişir.</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Net trendleri + tekrar */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardHeader
            icon={<TrendingUp size={16} />}
            title="Net gelişimi"
            subtitle="Son 10 deneme · kesikli çizgi hedefin"
            action={
              <Button variant="ghost" size="sm" onClick={() => go('exams')} icon={<ArrowRight size={14} />}>
                Denemeler
              </Button>
            }
          />
          <div className="grid grid-cols-1 gap-5 px-5 pb-5 pt-4 sm:grid-cols-2">
            <NetTrend title="TYT" rows={tytSeries} target={settings.targetTytNet} color="rgb(var(--accent))" onAdd={() => go('exams', { new: true })} />
            <NetTrend title="AYT" rows={aytSeries} target={settings.targetAytNet} color="rgb(var(--accent-2))" onAdd={() => go('exams', { new: true })} />
          </div>
        </Card>

        <Card className="flex flex-col lg:col-span-5">
          <CardHeader
            icon={<RefreshCcw size={16} />}
            title="Bugün tekrar edilecekler"
            subtitle="Aralıklı tekrar planına göre"
            action={due.length > 0 ? <Badge color="#bd934c">{due.length} konu</Badge> : undefined}
          />
          <div className="mt-3 flex-1 border-t border-border">
            {due.length === 0 ? (
              <EmptyState
                className="py-8"
                icon={<Check size={20} />}
                title="Bugün için tekrar yok"
                description="Konu Takibi'nde bir konuyu 'Konu bitti' yaptığında tekrar günleri otomatik planlanır."
                action={
                  <Button size="sm" variant="outline" onClick={() => go('topics')}>
                    Konu takibine git
                  </Button>
                }
              />
            ) : (
              <div className="divide-y divide-border">
                {due.slice(0, 6).map((d) => {
                  const topic = TOPIC_MAP[d.topicId]
                  const subject = SUBJECT_MAP[d.subjectId]
                  return (
                    <div key={d.topicId} className="flex items-center gap-3 px-5 py-2.5">
                      <span className="h-7 w-1 shrink-0 rounded-full" style={{ background: subjectColor(d.subjectId) }} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{topic?.name ?? d.topicId}</div>
                        <div className="truncate text-xs text-muted">
                          {subject ? `${subject.exam} ${subject.name}` : ''}
                          {d.overdue > 0 && <span className="text-warning"> · {d.overdue} gün gecikti</span>}
                        </div>
                      </div>
                      <Button size="sm" variant="outline" icon={<Check size={13} />} onClick={() => markReviewed(d.topicId)}>
                        Tekrar ettim
                      </Button>
                    </div>
                  )
                })}
                {due.length > 6 && (
                  <button onClick={() => go('topics')} className="w-full px-5 py-2.5 text-center text-xs text-muted hover:text-accent">
                    +{due.length - 6} konu daha
                  </button>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Zayıf konular + ders ilerlemesi */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card className="flex flex-col lg:col-span-5">
          <CardHeader
            icon={<TrendingDown size={16} />}
            title="En zayıf 5 konu"
            subtitle="Deneme hataları ve soru çözümlerinden"
            action={
              <Button variant="ghost" size="sm" onClick={() => go('analysis')} icon={<ArrowRight size={14} />}>
                Analiz
              </Button>
            }
          />
          <div className="mt-3 flex-1 border-t border-border">
            {weak.length === 0 ? (
              <EmptyState
                className="py-8"
                icon={<TrendingDown size={20} />}
                title="Henüz zayıf konu belirlenmedi"
                description="Denemelerine yanlış yaptığın konuları ekledikçe öncelik listen burada oluşur."
              />
            ) : (
              <div className="divide-y divide-border">
                {weak.map((w, i) => (
                  <button
                    key={w.topicId}
                    onClick={() => go('analysis')}
                    className="flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors hover:bg-surface-2/60"
                  >
                    <span className="tabular grid h-6 w-6 shrink-0 place-items-center rounded-md bg-danger/10 text-xs font-semibold text-danger">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{w.topicName}</div>
                      <div className="flex items-center gap-1.5 truncate text-xs text-muted">
                        <Dot color={subjectColor(w.subjectId)} size={6} />
                        {w.subjectName}
                        {w.examMistakes > 0 && <span>· {w.examMistakes} hata</span>}
                        {w.openNotes > 0 && <span>· {w.openNotes} açık not</span>}
                      </div>
                    </div>
                    <div className="w-14 shrink-0">
                      <ProgressBar value={w.score / weak[0].score} color="rgb(var(--danger))" height={4} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card className="lg:col-span-7">
          <CardHeader
            icon={<BookOpenCheck size={16} />}
            title="Konu ilerlemesi"
            subtitle={progressExam === 'AYT' ? `AYT · ${FIELD_LABEL[settings.field]}` : 'TYT · tüm dersler'}
            action={
              <Segmented
                size="sm"
                value={progressExam}
                onChange={setProgressExam}
                options={[
                  { value: 'TYT', label: 'TYT' },
                  { value: 'AYT', label: 'AYT' }
                ]}
              />
            }
          />
          <div className="px-5 pb-5 pt-4">
            {progressSubjects.length === 0 ? (
              <EmptyState className="py-6" title="Bu alan için AYT dersi yok" description="Dil alanında AYT yerine YDT çözülür; TYT ilerlemeni takip edebilirsin." />
            ) : (
              <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
                {progressSubjects.map((s) => {
                  const p = subjectProgress(data, s)
                  return (
                    <button key={s.id} onClick={() => go('topics')} className="group text-left">
                      <div className="flex items-center gap-2 text-xs">
                        <Dot color={s.color} />
                        <span className="min-w-0 flex-1 truncate font-medium text-text group-hover:text-accent">{s.name}</span>
                        <span className="tabular text-subtle">
                          {p.done}/{p.total}
                        </span>
                        <span className="tabular w-9 text-right font-medium text-muted">%{Math.round(p.pct * 100)}</span>
                      </div>
                      <ProgressBar value={p.pct} color={s.color} height={5} className="mt-1.5" />
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </Card>
      </div>

      <p className="mt-6 flex items-start gap-1.5 text-[11px] leading-relaxed text-subtle">
        <Info size={12} className="mt-0.5 shrink-0" />
        {CURRICULUM_NOTE}
      </p>
    </div>
  )
}
