import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type Simulation, type SimulationLinkDatum, type SimulationNodeDatum } from 'd3-force'
import { Maximize2, Minus, Plus } from 'lucide-react'
import { SUBJECT_MAP, TOPIC_MAP } from '@/data/curriculum'
import { Button } from '@/components/ui'
import { STATUS_COLOR, STATUS_LABEL } from '@/lib/brain'
import { topicShort, type SkillRow } from './shared'

interface GNode extends SimulationNodeDatum {
  id: string
  type: 'skill' | 'topic'
  r: number
  label: string
  color: string
  ring?: string
  subjectId?: string
}
type GLink = SimulationLinkDatum<GNode>
interface View {
  x: number
  y: number
  k: number
}

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v))
const trunc = (s: string, n: number): string => (s.length > n ? s.slice(0, n - 1) + '…' : s)

export function BrainGraph({
  skills,
  selectedId,
  onSelect,
  onOpen
}: {
  skills: SkillRow[]
  selectedId?: string
  onSelect: (id: string) => void
  onOpen: (id: string) => void
}): React.JSX.Element {
  const wrap = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [size, setSize] = useState({ w: 900, h: 560 })
  const [view, setView] = useState<View>({ x: 450, y: 280, k: 1 })
  const viewRef = useRef(view)
  viewRef.current = view
  const [hover, setHover] = useState<string | null>(null)
  const [, bump] = useReducer((n: number) => n + 1, 0)
  const sim = useRef<Simulation<GNode, GLink> | null>(null)
  const nodesRef = useRef<GNode[]>([])
  const linksRef = useRef<GLink[]>([])
  const fitted = useRef(false)
  const raf = useRef(0)
  const drag = useRef<{ node?: GNode; sx: number; sy: number; vx: number; vy: number; moved: boolean } | null>(null)

  // Veri imzası: yalnızca yapı değişince simülasyon yeniden kurulur
  const sig = skills.map((s) => `${s.id}:${s.topicIds.join(',')}:${s.evidence.length}:${s.strength.status}`).join('|')

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    setSize({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  const fit = (w = size.w, h = size.h): void => {
    const ns = nodesRef.current
    if (!ns.length) return
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    for (const n of ns) {
      x0 = Math.min(x0, (n.x ?? 0) - n.r - 90)
      x1 = Math.max(x1, (n.x ?? 0) + n.r + 90)
      y0 = Math.min(y0, (n.y ?? 0) - n.r - 40)
      y1 = Math.max(y1, (n.y ?? 0) + n.r + 55)
    }
    const k = clamp(Math.min(w / (x1 - x0), h / (y1 - y0)), 0.35, 1.25)
    setView({ k, x: w / 2 - ((x0 + x1) / 2) * k, y: h / 2 - ((y0 + y1) / 2) * k })
  }

  useEffect(() => {
    const prev = new Map(nodesRef.current.map((n) => [n.id, n]))
    const nodes: GNode[] = []
    const links: GLink[] = []
    const topicSeen = new Map<string, GNode>()
    for (const s of skills) {
      const old = prev.get('s:' + s.id)
      nodes.push({
        id: 's:' + s.id,
        type: 'skill',
        r: clamp(7 + Math.sqrt(s.evidence.length) * 2.6, 8, 20),
        label: s.name,
        color: STATUS_COLOR[s.strength.status],
        x: old?.x,
        y: old?.y
      })
      for (const t of s.topicIds) {
        const info = TOPIC_MAP[t]
        if (!info) continue
        let tn = topicSeen.get(t)
        if (!tn) {
          const o = prev.get('t:' + t)
          tn = { id: 't:' + t, type: 'topic', r: 4.5, label: topicShort(t), color: 'rgb(var(--subtle))', ring: SUBJECT_MAP[info.subjectId]?.color, subjectId: info.subjectId, x: o?.x, y: o?.y }
          topicSeen.set(t, tn)
          nodes.push(tn)
        }
        links.push({ source: 's:' + s.id, target: tn.id })
      }
    }
    // Dersler için çember üzerinde çapa noktaları: aynı dersin konuları kümelenir, köprü beceriler arada kalır
    const subs = [...new Set(nodes.filter((n) => n.type === 'topic').map((n) => n.subjectId as string))]
    const R = subs.length > 1 ? 150 : 0
    const anchor = new Map(subs.map((id, i) => [id, { x: Math.cos((i / subs.length) * Math.PI * 2 - Math.PI / 2) * R, y: Math.sin((i / subs.length) * Math.PI * 2 - Math.PI / 2) * R * 0.75 }]))

    sim.current?.stop()
    const s = forceSimulation<GNode>(nodes)
      .force('link', forceLink<GNode, GLink>(links).id((d) => d.id).distance(120).strength(0.45))
      .force('charge', forceManyBody<GNode>().strength((d) => (d.type === 'skill' ? -520 : -160)))
      .force('collide', forceCollide<GNode>().radius((d) => d.r + (d.type === 'skill' ? Math.min(90, 16 + d.label.length * 2.6) : 34)).strength(0.9))
      .force('x', forceX<GNode>((d) => (d.subjectId ? anchor.get(d.subjectId)?.x ?? 0 : 0)).strength((d) => (d.type === 'topic' ? 0.16 : 0.035)))
      .force('y', forceY<GNode>((d) => (d.subjectId ? anchor.get(d.subjectId)?.y ?? 0 : 0)).strength((d) => (d.type === 'topic' ? 0.16 : 0.035)))
      .alphaDecay(0.03)
    s.stop()
    for (let i = 0; i < 300; i++) s.tick()
    nodesRef.current = nodes
    linksRef.current = links
    sim.current = s
    s.on('tick', () => {
      if (!raf.current) raf.current = requestAnimationFrame(() => ((raf.current = 0), bump()))
    })
    if (!fitted.current && wrap.current) {
      fitted.current = true
      fit(wrap.current.clientWidth, wrap.current.clientHeight)
    }
    bump()
    return () => {
      s.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig])

  // Tekerlek ile yakınlaştırma (pasif olmayan dinleyici gerekir)
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      const mx = e.clientX - r.left
      const my = e.clientY - r.top
      setView((v) => {
        const k = clamp(v.k * Math.exp(-e.deltaY * 0.0015), 0.25, 3)
        return { k, x: mx - ((mx - v.x) * k) / v.k, y: my - ((my - v.y) * k) / v.k }
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const zoomBy = (f: number): void =>
    setView((v) => {
      const k = clamp(v.k * f, 0.25, 3)
      const mx = size.w / 2
      const my = size.h / 2
      return { k, x: mx - ((mx - v.x) * k) / v.k, y: my - ((my - v.y) * k) / v.k }
    })

  const toGraph = (e: { clientX: number; clientY: number }): { x: number; y: number } => {
    const r = svgRef.current!.getBoundingClientRect()
    const v = viewRef.current
    return { x: (e.clientX - r.left - v.x) / v.k, y: (e.clientY - r.top - v.y) / v.k }
  }

  const onBgDown = (e: React.PointerEvent): void => {
    svgRef.current?.setPointerCapture(e.pointerId)
    drag.current = { sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, moved: false }
  }
  const onNodeDown = (e: React.PointerEvent, n: GNode): void => {
    e.stopPropagation()
    svgRef.current?.setPointerCapture(e.pointerId)
    drag.current = { node: n, sx: e.clientX, sy: e.clientY, vx: 0, vy: 0, moved: false }
  }
  const onMove = (e: React.PointerEvent): void => {
    const d = drag.current
    if (!d) return
    if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 3) d.moved = true
    if (d.node) {
      if (!d.moved) return
      const p = toGraph(e)
      d.node.fx = p.x
      d.node.fy = p.y
      sim.current?.alphaTarget(0.25).restart()
    } else {
      setView((v) => ({ ...v, x: d.vx + e.clientX - d.sx, y: d.vy + e.clientY - d.sy }))
    }
  }
  const onUp = (): void => {
    const d = drag.current
    drag.current = null
    if (!d) return
    if (d.node) {
      d.node.fx = null
      d.node.fy = null
      sim.current?.alphaTarget(0)
      if (!d.moved && d.node.type === 'skill') onSelect(d.node.id.slice(2))
    }
  }

  const nodes = nodesRef.current
  const links = linksRef.current
  const focusId = hover ?? (selectedId ? 's:' + selectedId : null)
  const nb = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const l of links) {
      const a = (l.source as GNode).id
      const b = (l.target as GNode).id
      if (!m.has(a)) m.set(a, new Set())
      if (!m.has(b)) m.set(b, new Set())
      m.get(a)!.add(b)
      m.get(b)!.add(a)
    }
    return m
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, nodes.length])
  const lit = (id: string): boolean => !focusId || id === focusId || !!nb.get(focusId)?.has(id)
  const sel = skills.find((s) => s.id === selectedId)

  return (
    <div ref={wrap} className="relative h-full min-h-[460px] w-full overflow-hidden rounded-2xl border border-border bg-surface">
      <svg
        ref={svgRef}
        className="absolute inset-0 h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
        onPointerDown={onBgDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <defs>
          <pattern id="brain-dots" width={28 * view.k} height={28 * view.k} patternUnits="userSpaceOnUse" x={view.x} y={view.y}>
            <circle cx={1} cy={1} r={0.9} fill="rgb(var(--border))" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#brain-dots)" />
        <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
          {links.map((l, i) => {
            const a = l.source as GNode
            const b = l.target as GNode
            if (a.x == null || b.x == null) return null
            const on = !focusId || ((a.id === focusId || b.id === focusId) && true)
            const sk = a.type === 'skill' ? a : b
            return (
              <line
                key={i}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={focusId && on ? sk.color : 'rgb(var(--subtle))'}
                strokeOpacity={focusId ? (on ? 0.7 : 0.06) : 0.28}
                strokeWidth={focusId && on ? 1.4 : 1}
                style={{ transition: 'stroke-opacity .2s' }}
              />
            )
          })}
          {nodes.map((n) => {
            const isSkill = n.type === 'skill'
            const on = lit(n.id)
            const isSel = isSkill && n.id === 's:' + selectedId
            const showLabel = isSkill || view.k > 0.75 || n.id === focusId || !!(focusId && nb.get(focusId)?.has(n.id))
            return (
              <g
                key={n.id}
                transform={`translate(${n.x ?? 0},${n.y ?? 0})`}
                opacity={on ? 1 : 0.2}
                style={{ transition: 'opacity .2s', cursor: isSkill ? 'pointer' : 'grab' }}
                onPointerDown={(e) => onNodeDown(e, n)}
                onPointerEnter={() => setHover(n.id)}
                onPointerLeave={() => setHover(null)}
                onDoubleClick={() => isSkill && onOpen(n.id.slice(2))}
              >
                {isSel && <circle r={n.r + 5} fill="none" stroke={n.color} strokeOpacity={0.5} strokeWidth={1.2} />}
                <circle
                  r={n.r}
                  fill={n.color}
                  fillOpacity={isSkill ? 0.92 : 0.55}
                  stroke={isSkill ? 'rgb(var(--surface))' : n.ring}
                  strokeWidth={isSkill ? 2 : 1.4}
                />
                {showLabel && (
                  <text
                    y={n.r + (isSkill ? 14 : 12)}
                    textAnchor="middle"
                    fontSize={isSkill ? 12 : 10}
                    fontWeight={isSkill ? 500 : 400}
                    fill={isSkill ? 'rgb(var(--text))' : 'rgb(var(--muted))'}
                    stroke="rgb(var(--surface))"
                    strokeWidth={3.5}
                    strokeLinejoin="round"
                    paintOrder="stroke"
                    className="pointer-events-none"
                  >
                    {isSkill && n.id !== focusId ? trunc(n.label, 30) : n.label}
                  </text>
                )}
              </g>
            )
          })}
        </g>
      </svg>

      {/* Lejant */}
      <div className="pointer-events-none absolute bottom-3 left-4 flex items-center gap-4 text-[11px] text-subtle">
        {(['zayif', 'gelisiyor', 'guclu'] as const).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[k] }} />
            {STATUS_LABEL[k]}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-subtle/60" />
          Konu
        </span>
      </div>

      {/* Yakınlaştırma */}
      <div className="absolute bottom-3 right-3 flex flex-col overflow-hidden rounded-lg border border-border bg-surface/90 backdrop-blur">
        {[
          { i: <Plus size={14} />, f: () => zoomBy(1.25), l: 'Yakınlaştır' },
          { i: <Minus size={14} />, f: () => zoomBy(0.8), l: 'Uzaklaştır' },
          { i: <Maximize2 size={13} />, f: () => fit(), l: 'Sığdır' }
        ].map((b) => (
          <button key={b.l} type="button" aria-label={b.l} onClick={b.f} className="grid h-8 w-8 place-items-center text-muted transition-colors hover:bg-surface-2 hover:text-text">
            {b.i}
          </button>
        ))}
      </div>

      {/* Seçili beceri paneli */}
      {sel && (
        <div className="absolute right-4 top-4 w-[270px] rounded-xl border border-border bg-surface/95 p-4 backdrop-blur">
          <div className="text-[13px] font-medium leading-snug">{sel.name}</div>
          <div className="mt-3 flex items-center gap-2.5">
            <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-surface-3">
              <div className="h-full rounded-full" style={{ width: `${Math.max(3, sel.strength.score)}%`, background: STATUS_COLOR[sel.strength.status] }} />
            </div>
            <span className="tabular text-[11px] text-muted">
              {STATUS_LABEL[sel.strength.status]} · {sel.strength.score}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-subtle">
            {sel.topicIds.map((t) => (
              <span key={t}>{topicShort(t)}</span>
            ))}
          </div>
          <Button variant="outline" size="sm" className="mt-3 w-full justify-center" onClick={() => onOpen(sel.id)}>
            Ayrıntıyı aç
          </Button>
        </div>
      )}
    </div>
  )
}
