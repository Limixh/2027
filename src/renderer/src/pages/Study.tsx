import { Clock, Flame, Flag, Hash, Pencil, Plus, Sigma, Sun, Target, Trash2, Trophy } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { StudySession } from '../../../shared/types'
import { Heatmap } from '@/components/Heatmap'
import { SessionForm, type SessionDefaults } from '@/components/study/SessionForm'
import { DailyBars, SubjectDistribution, WeekdayChart } from '@/components/study/StudyCharts'
import { KIND_COLOR, KIND_LABEL, subjectColor, subjectShortFull } from '@/components/study/meta'
import { SubjectOptions } from '@/components/study/SubjectSelect'
import { TimerPanel } from '@/components/study/TimerPanel'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  confirm,
  EmptyState,
  PageHeader,
  ProgressRing,
  Segmented,
  Select,
  StatCard,
  toast
} from '@/components/ui'
import { TOPIC_MAP } from '@/data/curriculum'
import { addDays, formatDate, formatHours, formatMinutes, relativeDay, todayKey, weekdayName } from '@/lib/date'
import { useNav } from '@/lib/nav'
import { currentStreak, longestStreak, minutesByDay, thisWeekMinutes } from '@/lib/stats'
import { useStore } from '@/lib/store'

type HeatRange = '12m' | 'journey'

/* ------------------------------------------------------------------ */
/* Tek oturum satırı                                                   */
/* ------------------------------------------------------------------ */

function SessionRow({
  s,
  showDate,
  onEdit,
  onDelete
}: {
  s: StudySession
  showDate?: boolean
  onEdit: (s: StudySession) => void
  onDelete: (s: StudySession) => void
}): React.JSX.Element {
  const color = subjectColor(s.subjectId)
  const topic = s.topicId ? TOPIC_MAP[s.topicId] : undefined
  const kind = s.kind ?? 'konu'
  return (
    <div className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2/60">
      <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: color }} />
      {showDate && (
        <div className="w-[88px] shrink-0">
          <div className="text-xs font-medium text-text">{relativeDay(s.date)}</div>
          <div className="text-[11px] text-subtle">{weekdayName(s.date)}</div>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-sm font-medium text-text">{s.subjectId ? subjectShortFull(s.subjectId) : 'Dersiz çalışma'}</span>
          <Badge color={KIND_COLOR[kind]}>{KIND_LABEL[kind]}</Badge>
        </div>
        <div className="truncate text-xs text-muted">
          {topic?.name ?? ''}
          {topic && s.note ? ' · ' : ''}
          {s.note ?? ''}
          {!topic && !s.note && <span className="text-subtle">Konu / not yok</span>}
        </div>
      </div>
      {s.solved ? (
        <div className="hidden shrink-0 text-right text-xs sm:block">
          <div className="tabular font-medium text-text">{s.solved} soru</div>
          {(s.correct !== undefined || s.wrong !== undefined) && (
            <div className="tabular text-subtle">
              <span className="text-success">{s.correct ?? 0} D</span> · <span className="text-danger">{s.wrong ?? 0} Y</span>
            </div>
          )}
        </div>
      ) : null}
      <div className="tabular w-[72px] shrink-0 text-right text-sm font-semibold text-text">{formatMinutes(s.minutes)}</div>
      <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <Button variant="ghost" size="icon" onClick={() => onEdit(s)} aria-label="Düzenle" title="Düzenle">
          <Pencil size={14} />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => onDelete(s)} aria-label="Sil" title="Sil" className="hover:text-danger">
          <Trash2 size={14} />
        </Button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Sayfa                                                               */
/* ------------------------------------------------------------------ */

export default function Study(): React.JSX.Element {
  const sessions = useStore((s) => s.data.sessions)
  const settings = useStore((s) => s.data.settings)
  const deleteSession = useStore((s) => s.deleteSession)
  const params = useNav((s) => s.params)

  const today = todayKey()
  const goal = settings.dailyGoalMinutes

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<StudySession | undefined>()
  const [defaults, setDefaults] = useState<SessionDefaults | undefined>()
  const [heatRange, setHeatRange] = useState<HeatRange>('12m')
  const [selectedDay, setSelectedDay] = useState(today)
  const [filter, setFilter] = useState('')
  const [limit, setLimit] = useState(12)

  const openNew = useCallback((d?: SessionDefaults) => {
    setEditing(undefined)
    setDefaults(d)
    setFormOpen(true)
  }, [])

  // go('study', { new: true }) ile gelindiyse ekleme penceresini aç
  useEffect(() => {
    if (params.new) {
      openNew()
      useNav.setState({ params: {} })
    }
  }, [params, openNew])

  const onEdit = useCallback((s: StudySession) => {
    setEditing(s)
    setDefaults(undefined)
    setFormOpen(true)
  }, [])

  const onDelete = useCallback(
    async (s: StudySession) => {
      const ok = await confirm({
        title: 'Çalışma kaydı silinsin mi?',
        message: `${formatDate(s.date)} tarihli ${formatMinutes(s.minutes)} süreli kayıt kalıcı olarak silinecek.`
      })
      if (ok) {
        deleteSession(s.id)
        toast('Kayıt silindi', 'info')
      }
    },
    [deleteSession]
  )

  /* ---------- türetilmiş veriler ---------- */
  const byDay = useMemo(() => minutesByDay(sessions), [sessions])

  const stats = useMemo(() => {
    let total = 0
    let solved = 0
    for (const s of sessions) {
      total += s.minutes
      solved += s.solved ?? 0
    }
    const activeDays = [...byDay.values()].filter((m) => m > 0).length
    return {
      todayMin: byDay.get(today) ?? 0,
      week: thisWeekMinutes(byDay),
      streak: currentStreak(byDay),
      longest: longestStreak(byDay),
      total,
      activeDays,
      avg: activeDays ? total / activeDays : 0,
      solved
    }
  }, [sessions, byDay, today])

  const firstDate = useMemo(() => sessions.reduce((min, s) => (s.date < min ? s.date : min), today), [sessions, today])

  const heatProps = useMemo(() => {
    if (heatRange === '12m') return { from: undefined, to: undefined, markDate: undefined }
    const from = sessions.length ? firstDate : addDays(today, -90)
    const to = settings.examDate > today ? settings.examDate : today
    return { from, to, markDate: settings.examDate >= from && settings.examDate <= to ? settings.examDate : undefined }
  }, [heatRange, sessions.length, firstDate, today, settings.examDate])

  const daySessions = useMemo(
    () => sessions.filter((s) => s.date === selectedDay).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [sessions, selectedDay]
  )
  const dayTotal = byDay.get(selectedDay) ?? 0

  const sorted = useMemo(
    () => sessions.slice().sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date))),
    [sessions]
  )
  const filtered = useMemo(
    () => (filter ? sorted.filter((s) => (filter === 'diger' ? !s.subjectId : s.subjectId === filter)) : sorted),
    [sorted, filter]
  )

  const goalPct = goal > 0 ? stats.todayMin / goal : 0

  return (
    <div>
      <PageHeader
        title="Çalışma Takibi"
        description="Her gün biraz daha: çalışma sürelerini kaydet, ısı haritanı renklendir."
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => openNew()}>
            Çalışma ekle
          </Button>
        }
      />

      {/* Özet */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Card className="relative overflow-hidden p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted">Bugün</span>
            <ProgressRing value={goalPct} size={34} stroke={4} color={goalPct >= 1 ? 'rgb(var(--success))' : undefined}>
              <span className="tabular text-[9px] font-semibold text-muted">{Math.min(999, Math.round(goalPct * 100))}</span>
            </ProgressRing>
          </div>
          <div className="tabular mt-2 text-2xl font-semibold tracking-tight">{formatMinutes(stats.todayMin)}</div>
          <div className="mt-0.5 text-xs text-muted">
            {goalPct >= 1 ? 'Günlük hedef tamam' : `Hedef ${formatHours(goal)}`}
          </div>
        </Card>
        <StatCard label="Bu hafta" value={formatHours(stats.week)} sub={`${formatMinutes(stats.week)} toplam`} icon={<Sun size={14} />} accent="rgb(var(--info))" />
        <StatCard
          label="Seri"
          value={
            <>
              {stats.streak} <span className="text-sm font-medium text-muted">gün</span>
            </>
          }
          sub={`En uzun seri: ${stats.longest} gün`}
          icon={<Flame size={14} />}
          accent="rgb(var(--warning))"
        />
        <StatCard label="Toplam süre" value={formatHours(stats.total)} sub={`${stats.activeDays} aktif gün`} icon={<Clock size={14} />} accent="rgb(var(--accent))" />
        <StatCard label="Aktif gün ortalaması" value={formatHours(stats.avg)} sub="Çalıştığın günlerde" icon={<Target size={14} />} accent="rgb(var(--success))" />
        <StatCard label="Çözülen soru" value={stats.solved.toLocaleString('tr-TR')} sub="Kayıtlı oturumlardan" icon={<Sigma size={14} />} accent="rgb(var(--accent-2))" />
      </div>

      {/* Isı haritası */}
      <Card className="mt-4">
        <CardHeader
          icon={<Flag size={16} />}
          title="Aktivite haritası"
          subtitle={
            heatRange === '12m'
              ? `Son 12 ay · günlük hedef ${formatHours(goal)}`
              : `Yolculuğun, sınav gününe (${formatDate(settings.examDate)}) kadar`
          }
          action={
            <Segmented
              size="sm"
              value={heatRange}
              onChange={setHeatRange}
              options={[
                { value: '12m', label: 'Son 12 ay' },
                { value: 'journey', label: 'YKS yolculuğu' }
              ]}
            />
          }
        />
        <div className="px-5 pb-4 pt-4">
          <Heatmap data={byDay} goal={goal} from={heatProps.from} to={heatProps.to} markDate={heatProps.markDate} selected={selectedDay} onSelect={setSelectedDay} />
        </div>

        {/* Seçili gün */}
        <div className="border-t border-border">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
            <div>
              <div className="text-sm font-semibold">
                {formatDate(selectedDay)} <span className="font-normal text-muted">· {weekdayName(selectedDay)}</span>
              </div>
              <div className="text-xs text-muted">
                {daySessions.length
                  ? `${daySessions.length} oturum · toplam ${formatMinutes(dayTotal)}${goal > 0 ? ` (hedefin %${Math.round((dayTotal / goal) * 100)}'i)` : ''}`
                  : 'Bu gün için kayıtlı çalışma yok'}
              </div>
            </div>
            <Button size="sm" variant="outline" icon={<Plus size={14} />} onClick={() => openNew({ date: selectedDay })}>
              Bu güne ekle
            </Button>
          </div>
          {daySessions.length > 0 && (
            <div className="divide-y divide-border border-t border-border">
              {daySessions.map((s) => (
                <SessionRow key={s.id} s={s} onEdit={onEdit} onDelete={onDelete} />
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Zamanlayıcı + günlük grafik */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <TimerPanel onDetailed={(d) => openNew(d)} />
        </div>
        <div className="lg:col-span-7">
          <DailyBars sessions={sessions} goal={goal} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <WeekdayChart byDay={byDay} />
        </div>
        <div className="lg:col-span-7">
          <SubjectDistribution sessions={sessions} />
        </div>
      </div>

      {/* Son oturumlar */}
      <Card className="mt-4">
        <CardHeader
          icon={<Hash size={16} />}
          title="Son çalışmalar"
          subtitle={`${filtered.length} kayıt`}
          action={
            <Select value={filter} onChange={(e) => { setFilter(e.target.value); setLimit(12) }} className="h-8 w-[200px] text-xs">
              <option value="">Tüm dersler</option>
              <option value="diger">Dersiz</option>
              <SubjectOptions />
            </Select>
          }
        />
        <div className="mt-3 border-t border-border">
          {filtered.length === 0 ? (
            sessions.length === 0 ? (
              <EmptyState
                icon={<Trophy size={22} />}
                title="İlk çalışmanı kaydet"
                description="Zamanlayıcıyı başlat ya da geçmiş bir çalışmayı elle ekle. Seri ve ısı haritan ilk kayıtla başlar."
                action={
                  <Button variant="primary" icon={<Plus size={16} />} onClick={() => openNew()}>
                    Çalışma ekle
                  </Button>
                }
              />
            ) : (
              <EmptyState title="Bu derse ait kayıt yok" description="Filtreyi değiştirmeyi dene." />
            )
          ) : (
            <>
              <div className="divide-y divide-border">
                {filtered.slice(0, limit).map((s) => (
                  <SessionRow key={s.id} s={s} showDate onEdit={onEdit} onDelete={onDelete} />
                ))}
              </div>
              {filtered.length > limit && (
                <div className="border-t border-border p-3 text-center">
                  <Button variant="ghost" size="sm" onClick={() => setLimit((l) => l + 20)}>
                    Daha fazla göster ({filtered.length - limit})
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </Card>

      <SessionForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        session={editing}
        defaults={defaults}
      />
    </div>
  )
}
