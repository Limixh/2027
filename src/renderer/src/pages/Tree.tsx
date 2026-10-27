// Konu Ağacı: yetenek ağacı düzeninde konu ilerlemesi. Ders ortada, konu grupları dışa doğru açılan dallar,
// konular dal boyunca düğümler. Sade görünüm: her ders tek renk, ilerleme o rengin dolgusuyla gösterilir.
// Sahne sürüklenir, tekerlekle yakınlaştırılır; düğüme tıklayınca konu paneli açılır.
import { useEffect, useMemo, useRef, useState } from 'react'
import { BookOpenCheck, Check, Maximize2, Minus, NotebookPen, Plus, RotateCcw, X } from 'lucide-react'
import type { ExamType, Subject, Topic, TopicStatus } from '../../../shared/types'
import { Button, Segmented, cn, toast } from '@/components/ui'
import { STATUS_META } from '@/components/topics/meta'
import { subjectsFor } from '@/data/curriculum'
import { STATUS_COLOR as SKILL_COLOR, STATUS_LABEL as SKILL_LABEL, sortedSkills } from '@/lib/brain'
import { formatDate } from '@/lib/date'
import { useNav } from '@/lib/nav'
import { useStore } from '@/lib/store'
import { STATUS_XP, branchesOf, levelOf, nodeStates, subjectTree, topicSignals, type NodeState } from '@/lib/tree'

const LABEL: Record<TopicStatus, string> = Object.fromEntries(STATUS_META.map((m) => [m.value, m.label])) as Record<TopicStatus, string>

/** Tek renk: uygulamanın vurgu rengi (ders renkleri bazı derslerde mor / pembe; burada sade kalsın) */
const ACCENT = 'rgb(var(--accent))'

/** İlerleme tek renkle: aşama arttıkça dolgu koyulaşır */
const FILL: Record<TopicStatus, number> = { 0: 0, 1: 0, 2: 0.3, 3: 0.6, 4: 1 }

/* ---------------- yerleşim ---------------- */

interface LNode {
  id: string
  kind: 'root' | 'branch' | 'topic'
  x: number
  y: number
  r: number
  label: string
  state?: NodeState
  topic?: Topic
  done?: number
  total?: number
}
interface LEdge {
  from: LNode
  to: LNode
  lit: boolean
}

/**
 * Ders merkezde. Her dal, konu sayısıyla orantılı bir dilim alır (büyük dal geniş açılır); konular dilim içinde
 * halka halka, yelpaze gibi dizilir ve yol zikzak ilerler. Böylece kalabalık bir dal upuzun bir kola dönüşmez.
 */
function layout(subject: Subject, progress: Parameters<typeof nodeStates>[1]): { nodes: LNode[]; edges: LEdge[] } {
  const branches = branchesOf(subject)
  const root: LNode = { id: 'root', kind: 'root', x: 0, y: 0, r: 56, label: subject.name }
  const nodes: LNode[] = [root]
  const edges: LEdge[] = []
  const BRANCH_R = 175 // dal düğümlerinin halkası
  const RING = 112 // konu halkaları arası
  const GAP = 132 // aynı halkada iki konu arası en az yay uzunluğu (etiket sığsın)
  const weights = branches.map((b) => Math.max(b.topics.length, 2.5))
  const sum = weights.reduce((a, b) => a + b, 0)
  let start = -Math.PI / 2 - (Math.PI * weights[0]) / sum // ilk dal tam yukarıda
  const polar = (a: number, d: number): { x: number; y: number } => ({ x: Math.cos(a) * d, y: Math.sin(a) * d })

  branches.forEach((b, k) => {
    const sector = (2 * Math.PI * weights[k]) / sum
    const mid = start + sector / 2
    start += sector
    const states = nodeStates(b, progress)
    const done = states.filter((s) => typeof s === 'number' && s >= 2).length
    const branch: LNode = { id: 'b' + k, kind: 'branch', ...polar(mid, BRANCH_R), r: 30, label: b.name, done, total: states.length }
    nodes.push(branch)
    edges.push({ from: root, to: branch, lit: done > 0 })

    // Konuları halkalara dağıt: her halkanın alabileceği konu sayısı yay uzunluğuna göre
    const span = sector * 0.78
    let i = 0
    let ring = 1
    let prev = branch
    while (i < b.topics.length) {
      const radius = BRANCH_R + RING * ring
      const cap = Math.max(1, Math.floor((radius * span) / GAP) + 1)
      const count = Math.min(cap, b.topics.length - i)
      // Zikzak: tek halkalarda soldan sağa, çiftlerde sağdan sola
      for (let j = 0; j < count; j++) {
        const slot = ring % 2 ? j : count - 1 - j
        const a = count === 1 ? mid : mid - span / 2 + (span * slot) / (count - 1)
        const t = b.topics[i]
        const st = states[i]
        const node: LNode = { id: t.id, kind: 'topic', ...polar(a, radius), r: 22, label: t.name, state: st, topic: t }
        nodes.push(node)
        edges.push({ from: prev, to: node, lit: typeof st === 'number' && st >= 2 })
        prev = node
        i++
      }
      ring++
    }
  })
  return { nodes, edges }
}

/* ---------------- konu paneli ---------------- */

function TopicPanel({ topic, subject, onClose }: { topic: Topic; subject: Subject; onClose: () => void }): React.JSX.Element {
  const data = useStore((s) => s.data)
  const setProgress = useStore((s) => s.setTopicProgress)
  const markReviewed = useStore((s) => s.markReviewed)
  const p = data.topicProgress[topic.id]
  const status = p?.status ?? 0
  const notes = data.mistakeNotes.filter((n) => n.topicId === topic.id)
  const open = notes.filter((n) => !n.resolved).length
  const skills = useMemo(() => sortedSkills(data).filter((s) => s.topicIds.includes(topic.id)), [data, topic.id])
  const c = ACCENT

  const setStatus = (st: TopicStatus): void => {
    if (st === status) return
    const gain = STATUS_XP[st] - STATUS_XP[status]
    setProgress(topic.id, { status: st })
    if (gain > 0) toast(`+${gain} XP · ${topic.name}: ${LABEL[st]}`)
  }

  return (
    <aside className="card absolute bottom-3 right-3 top-3 z-10 flex w-[320px] animate-fade-in flex-col overflow-y-auto p-5" onPointerDown={(e) => e.stopPropagation()}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-wider text-subtle">
            {subject.exam} {subject.name}
            {topic.group ? ` · ${topic.group}` : ''}
          </div>
          <h2 className="mt-1 text-lg font-semibold leading-snug">{topic.name}</h2>
        </div>
        <Button variant="ghost" size="icon" aria-label="Kapat" onClick={onClose}>
          <X size={15} />
        </Button>
      </div>

      <div className="mt-4 space-y-1">
        {STATUS_META.map((m) => {
          const on = m.value === status
          const reached = m.value > 0 && m.value <= status
          return (
            <button
              key={m.value}
              type="button"
              onClick={() => setStatus(m.value)}
              className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors', on ? 'bg-surface-2 font-medium' : 'text-muted hover:bg-surface-2/60 hover:text-text')}
            >
              <span
                className="grid h-5 w-5 place-items-center rounded-full border"
                style={{ borderColor: reached ? c : 'rgb(var(--border))', background: reached ? c : 'transparent' }}
              >
                {reached && <Check size={11} className="text-white" strokeWidth={3} />}
              </span>
              <span className="flex-1">{m.label}</span>
              <span className="tabular text-[11px] text-subtle">{STATUS_XP[m.value]} XP</span>
            </button>
          )
        })}
      </div>

      {status >= 2 && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
          <span>{p?.lastReview ? `Son tekrar: ${formatDate(p.lastReview)}${p.reviews ? ` · ${p.reviews} kez` : ''}` : 'Henüz tekrar edilmedi'}</span>
          <Button
            variant="outline"
            size="sm"
            icon={<RotateCcw size={12} />}
            onClick={() => {
              markReviewed(topic.id)
              toast('Tekrar kaydedildi')
            }}
          >
            Tekrar ettim
          </Button>
        </div>
      )}

      <div className="mt-5 space-y-4 border-t border-border pt-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted">Hata Defteri</span>
          <span className="tabular">
            {notes.length} soru{open ? <span className="text-danger"> · {open} açık</span> : null}
          </span>
        </div>
        {skills.length > 0 && (
          <div>
            <div className="mb-2 text-muted">İkinci Beyin’deki beceriler</div>
            <div className="flex flex-wrap gap-1.5">
              {skills.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => useNav.getState().go('brain', { skill: s.id })}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-xs hover:bg-surface-2"
                  title={`${SKILL_LABEL[s.strength.status]} · ${s.strength.score}`}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: SKILL_COLOR[s.strength.status] }} />
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" icon={<NotebookPen size={13} />} onClick={() => useNav.getState().go('mistakes', { new: true, subject: subject.id, topic: topic.id })}>
            Hata notu ekle
          </Button>
          <Button variant="ghost" size="sm" icon={<BookOpenCheck size={13} />} onClick={() => useNav.getState().go('topics', { subject: subject.id, exam: subject.exam })}>
            Konu Takibi’nde aç
          </Button>
        </div>
      </div>
    </aside>
  )
}

/* ---------------- sahne ---------------- */

const trunc = (s: string, n: number): string => (s.length > n ? s.slice(0, n - 1) + '…' : s)

function Scene({
  subject,
  progress,
  signals,
  selected,
  onSelect
}: {
  subject: Subject
  progress: Parameters<typeof nodeStates>[1]
  signals: ReturnType<typeof topicSignals>
  selected: string | null
  onSelect: (id: string | null) => void
}): React.JSX.Element {
  const { nodes, edges } = useMemo(() => layout(subject, progress), [subject, progress])
  const tree = subjectTree(subject, progress)
  const wrap = useRef<HTMLDivElement>(null)
  const [view, setView] = useState({ x: 0, y: 0, k: 1 })
  const drag = useRef<{ sx: number; sy: number; vx: number; vy: number } | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const c = ACCENT

  const fit = (): void => {
    const el = wrap.current
    if (!el) return
    const xs = nodes.map((n) => n.x), ys = nodes.map((n) => n.y)
    const pad = 100
    const x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad, y0 = Math.min(...ys) - pad, y1 = Math.max(...ys) + pad
    const k = Math.min(1.15, Math.max(0.3, Math.min(el.clientWidth / (x1 - x0), el.clientHeight / (y1 - y0))))
    setView({ k, x: el.clientWidth / 2 - ((x0 + x1) / 2) * k, y: el.clientHeight / 2 - ((y0 + y1) / 2) * k })
  }
  useEffect(fit, [subject.id]) // eslint-disable-line react-hooks/exhaustive-deps
  // Pencere / panel boyutu değişince sahneyi yeniden sığdır
  const fitRef = useRef(fit)
  fitRef.current = fit
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(() => fitRef.current())
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      const mx = e.clientX - r.left, my = e.clientY - r.top
      setView((v) => {
        const k = Math.min(2.5, Math.max(0.25, v.k * Math.exp(-e.deltaY * 0.0015)))
        return { k, x: mx - ((mx - v.x) * k) / v.k, y: my - ((my - v.y) * k) / v.k }
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const zoom = (f: number): void =>
    setView((v) => {
      const el = wrap.current!
      const mx = el.clientWidth / 2, my = el.clientHeight / 2
      const k = Math.min(2.5, Math.max(0.25, v.k * f))
      return { k, x: mx - ((mx - v.x) * k) / v.k, y: my - ((my - v.y) * k) / v.k }
    })

  return (
    <div
      ref={wrap}
      className="relative h-full w-full cursor-grab touch-none select-none overflow-hidden active:cursor-grabbing"
      onPointerDown={(e) => {
        ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
        drag.current = { sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y }
      }}
      onPointerMove={(e) => {
        const d = drag.current
        if (d) setView((v) => ({ ...v, x: d.vx + e.clientX - d.sx, y: d.vy + e.clientY - d.sy }))
      }}
      onPointerUp={() => (drag.current = null)}
    >
      <svg className="absolute inset-0 h-full w-full">
        <defs>
          <pattern id="tree-dots" width={28 * view.k} height={28 * view.k} patternUnits="userSpaceOnUse" x={view.x} y={view.y}>
            <circle cx={1} cy={1} r={0.9} fill="rgb(var(--border))" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#tree-dots)" />
        <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
          {/* bağlantılar: tamamlanan yol ders renginde, kalanı ince gri */}
          {edges.map((e, i) => {
            const mx = (e.from.x + e.to.x) / 2, my = (e.from.y + e.to.y) / 2
            const len = Math.hypot(mx, my) || 1
            const d = `M${e.from.x},${e.from.y} Q${mx + (mx / len) * 12},${my + (my / len) * 12} ${e.to.x},${e.to.y}`
            return <path key={i} d={d} fill="none" stroke={e.lit ? c : 'rgb(var(--border))'} strokeWidth={e.lit ? 3 : 2} strokeLinecap="round" />
          })}

          {nodes.map((n) => {
            if (n.kind === 'root')
              return (
                <g key={n.id} transform={`translate(${n.x},${n.y})`}>
                  <circle r={n.r} fill="rgb(var(--surface))" stroke="rgb(var(--border))" strokeWidth={2} />
                  <circle
                    r={n.r - 7}
                    fill="none"
                    stroke={c}
                    strokeWidth={5}
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * (n.r - 7) * tree.pct} 999`}
                    transform="rotate(-90)"
                  />
                  <text y={-2} textAnchor="middle" fontSize={20} fontWeight={650} fill="rgb(var(--text))">
                    %{Math.round(tree.pct * 100)}
                  </text>
                  <text y={16} textAnchor="middle" fontSize={11} fill="rgb(var(--muted))">
                    {trunc(subject.name, 16)}
                  </text>
                </g>
              )
            if (n.kind === 'branch') {
              const frac = (n.done ?? 0) / (n.total || 1)
              return (
                <g key={n.id} transform={`translate(${n.x},${n.y})`}>
                  <circle r={n.r} fill="rgb(var(--surface))" stroke="rgb(var(--border))" strokeWidth={2} />
                  <circle r={n.r - 5} fill="none" stroke={c} strokeWidth={4} strokeLinecap="round" strokeDasharray={`${2 * Math.PI * (n.r - 5) * frac} 999`} transform="rotate(-90)" />
                  <text y={4} textAnchor="middle" fontSize={12} fontWeight={600} fill="rgb(var(--text))">
                    {n.done}/{n.total}
                  </text>
                  <text y={n.r + 17} textAnchor="middle" fontSize={13} fontWeight={600} fill="rgb(var(--text))" stroke="rgb(var(--surface))" strokeWidth={4} paintOrder="stroke">
                    {trunc(n.label, 26)}
                  </text>
                </g>
              )
            }
            const st = n.state!
            const status = typeof st === 'number' ? st : 0
            const isSel = n.id === selected
            const isHover = n.id === hover
            const mist = signals.openMistakes.get(n.id) ?? 0
            const due = signals.due.has(n.id)
            const fill = FILL[status]
            return (
              <g
                key={n.id}
                transform={`translate(${n.x},${n.y})`}
                style={{ cursor: 'pointer' }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => onSelect(isSel ? null : n.id)}
                onPointerEnter={() => setHover(n.id)}
                onPointerLeave={() => setHover(null)}
              >
                {(isSel || isHover) && <circle r={n.r + 6} fill="none" stroke={c} strokeOpacity={isSel ? 0.8 : 0.35} strokeWidth={2} />}
                {/* zemin + ilerleme dolgusu */}
                <circle r={n.r} fill="rgb(var(--surface))" stroke={status > 0 || st === 'next' ? c : 'rgb(var(--border))'} strokeWidth={st === 'next' ? 2.5 : 2} strokeDasharray={st === 'next' ? '4 3' : undefined} />
                {fill > 0 && <circle r={n.r} fill={c} fillOpacity={fill} />}
                {/* çalışılıyor: yarım halka */}
                {status === 1 && <circle r={n.r - 6} fill="none" stroke={c} strokeWidth={4} strokeDasharray={`${Math.PI * (n.r - 6)} 999`} transform="rotate(-90)" />}
                {status >= 2 && (
                  <path d="M-7,0 L-2,5 L8,-5" fill="none" stroke={status >= 3 ? '#fff' : c} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
                )}
                {/* rozetler */}
                {mist > 0 && (
                  <g transform={`translate(${n.r * 0.75},${-n.r * 0.75})`}>
                    <circle r={8} fill="rgb(var(--danger))" stroke="rgb(var(--surface))" strokeWidth={2} />
                    <text y={3.5} textAnchor="middle" fontSize={9} fontWeight={700} fill="#fff">
                      {mist}
                    </text>
                  </g>
                )}
                {due && <circle cx={n.r * 0.75} cy={n.r * 0.75} r={5} fill="rgb(var(--warning))" stroke="rgb(var(--surface))" strokeWidth={2} />}
                <text
                  y={n.r + 15}
                  textAnchor="middle"
                  fontSize={12}
                  fontWeight={st === 'next' || isSel ? 600 : 400}
                  fill={st === 'locked' ? 'rgb(var(--subtle))' : 'rgb(var(--text))'}
                  stroke="rgb(var(--surface))"
                  strokeWidth={4}
                  paintOrder="stroke"
                >
                  {isHover || isSel ? n.label : trunc(n.label, 22)}
                </text>
                {st === 'next' && (
                  <text y={n.r + 28} textAnchor="middle" fontSize={10} fontWeight={600} fill={c} stroke="rgb(var(--surface))" strokeWidth={3} paintOrder="stroke">
                    sıradaki
                  </text>
                )}
              </g>
            )
          })}
        </g>
      </svg>

      <div className="absolute bottom-3 left-3 flex overflow-hidden rounded-lg border border-border bg-surface/90" onPointerDown={(e) => e.stopPropagation()}>
        {[
          { i: <Plus size={14} />, f: () => zoom(1.25), l: 'Yakınlaştır' },
          { i: <Minus size={14} />, f: () => zoom(0.8), l: 'Uzaklaştır' },
          { i: <Maximize2 size={13} />, f: fit, l: 'Sığdır' }
        ].map((b) => (
          <button key={b.l} type="button" aria-label={b.l} title={b.l} onClick={b.f} className="grid h-8 w-8 place-items-center text-muted hover:bg-surface-2 hover:text-text">
            {b.i}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ---------------- sayfa ---------------- */

export default function Tree(): React.JSX.Element {
  const data = useStore((s) => s.data)
  const field = data.settings.field
  const [exam, setExam] = useState<ExamType>('TYT')
  const subjects = useMemo(() => subjectsFor(exam, field), [exam, field])
  const [subjectId, setSubjectId] = useState<string>('')
  const progress = data.topicProgress
  // Seçim yoksa en çok ilerlenen ders açılır
  const subject =
    subjects.find((s) => s.id === subjectId) ??
    [...subjects].sort((a, b) => subjectTree(b, progress).xp - subjectTree(a, progress).xp)[0]
  const [topicId, setTopicId] = useState<string | null>(null)
  const signals = useMemo(() => topicSignals(data), [data])

  const totals = useMemo(() => {
    let xp = 0, done = 0, total = 0
    for (const s of [...subjectsFor('TYT'), ...subjectsFor('AYT', field)]) {
      const t = subjectTree(s, progress)
      xp += t.xp
      done += t.counts[2] + t.counts[3] + t.counts[4]
      total += t.total
    }
    return { xp, done, total, lv: levelOf(xp) }
  }, [field, progress])

  const selected = topicId && subject ? subject.topics.find((t) => t.id === topicId) : undefined

  return (
    <div className="pt-1">
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Konu Ağacı</h1>
        <Segmented
          size="sm"
          value={exam}
          onChange={(v) => {
            setExam(v)
            setSubjectId('')
            setTopicId(null)
          }}
          options={[
            { value: 'TYT', label: 'TYT' },
            { value: 'AYT', label: 'AYT' }
          ]}
        />
        {/* Seviye */}
        <div className="ml-auto flex items-center gap-3 text-xs text-muted">
          <span>
            Seviye <span className="tabular text-sm font-semibold text-text">{totals.lv.level}</span>
          </span>
          <div className="h-1.5 w-28 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(totals.lv.into / totals.lv.need) * 100}%` }} />
          </div>
          <span className="tabular">{totals.xp.toLocaleString('tr-TR')} XP</span>
          <span className="text-subtle">·</span>
          <span className="tabular">
            {totals.done}/{totals.total} konu bitti
          </span>
        </div>
      </div>

      {subjects.length === 0 || !subject ? (
        <p className="py-16 text-center text-sm text-muted">Dil alanında AYT yerine YDT çözülür; TYT ağacına bakabilirsin.</p>
      ) : (
        <>
          <div className="mb-3 flex gap-1 overflow-x-auto pb-1">
            {subjects.map((s) => {
              const t = subjectTree(s, progress)
              const on = s.id === subject.id
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSubjectId(s.id)
                    setTopicId(null)
                  }}
                  className={cn('shrink-0 rounded-lg px-3 py-1.5 text-xs transition-colors', on ? 'bg-surface-2 font-medium text-text' : 'text-muted hover:bg-surface-2/60 hover:text-text')}
                >
                  {s.name}
                  <span className="tabular ml-1.5 text-subtle">%{Math.round(t.pct * 100)}</span>
                </button>
              )
            })}
          </div>

          <div className="card relative h-[calc(100vh-10.5rem)] min-h-[500px] overflow-hidden">
            <Scene subject={subject} progress={progress} signals={signals} selected={topicId} onSelect={setTopicId} />

            {/* Lejant */}
            <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-4 text-[11px] text-muted" style={selected ? { right: 340 } : undefined}>
              {([1, 2, 3, 4] as TopicStatus[]).map((k) => (
                <span key={k} className="inline-flex items-center gap-1.5">
                  <svg width="12" height="12" viewBox="-7 -7 14 14">
                    <circle r={6} fill="rgb(var(--surface))" stroke={ACCENT} strokeWidth={1.5} />
                    {FILL[k] > 0 && <circle r={6} fill={ACCENT} fillOpacity={FILL[k]} />}
                    {k === 1 && <circle r={3} fill="none" stroke={ACCENT} strokeWidth={2} strokeDasharray="9.4 99" transform="rotate(-90)" />}
                  </svg>
                  {LABEL[k]}
                </span>
              ))}
            </div>

            {selected && <TopicPanel key={selected.id} topic={selected} subject={subject} onClose={() => setTopicId(null)} />}
          </div>
        </>
      )}
    </div>
  )
}
