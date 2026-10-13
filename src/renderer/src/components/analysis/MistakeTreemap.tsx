import { LayoutGrid } from 'lucide-react'
import { useMemo } from 'react'
import { ResponsiveContainer, Tooltip, Treemap } from 'recharts'
import { Card, CardHeader } from '@/components/ui'
import { SUBJECT_MAP } from '@/data/curriculum'
import type { TopicMistakeStat } from './derive'
import { TipBox } from './parts'

type Leaf = {
  name: string
  size: number
  fill: string
  subjectName: string
  exams: number
}
type Group = {
  name: string
  fill: string
  children: Leaf[]
}

interface NodeProps {
  x: number
  y: number
  width: number
  height: number
  depth: number
  name: string
  fill?: string
  size?: number
  value?: number
}

function Cell(p: NodeProps): React.JSX.Element {
  const { x, y, width, height, depth, name } = p
  const fill = p.fill ?? '#7b838f'
  if (depth === 0) return <g />
  if (depth === 1) {
    return (
      <g>
        <rect x={x} y={y} width={width} height={height} fill="none" stroke="rgb(var(--surface))" strokeWidth={3} rx={8} />
        {width > 60 && height > 22 && (
          <text x={x + 8} y={y + 15} fill={fill} fontSize={11} fontWeight={700} style={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
            {name}
          </text>
        )}
      </g>
    )
  }
  const showName = width > 56 && height > 58
  const maxChars = Math.max(4, Math.floor((width - 14) / 6.2))
  const label = name.length > maxChars ? name.slice(0, maxChars - 1) + '…' : name
  return (
    <g>
      <rect
        x={x + 1.5}
        y={y + 1.5}
        width={Math.max(0, width - 3)}
        height={Math.max(0, height - 3)}
        rx={6}
        fill={fill}
        fillOpacity={0.22}
        stroke={fill}
        strokeOpacity={0.55}
        strokeWidth={1}
      />
      {showName && (
        <>
          <text x={x + 8} y={y + 32} fill="rgb(var(--text))" fontSize={11} fontWeight={600}>
            {label}
          </text>
          <text x={x + 8} y={y + 47} fill="rgb(var(--muted))" fontSize={11}>
            {p.size ?? p.value} yanlış
          </text>
        </>
      )}
    </g>
  )
}

export function MistakeTreemap({ topics }: { topics: TopicMistakeStat[] }): React.JSX.Element {
  const data = useMemo<Group[]>(() => {
    const groups = new Map<string, Group>()
    for (const t of topics.slice(0, 45)) {
      const s = SUBJECT_MAP[t.subjectId]
      if (!s) continue
      let g = groups.get(s.id)
      if (!g) {
        g = { name: s.short, fill: s.color, children: [] }
        groups.set(s.id, g)
      }
      g.children.push({ name: t.name, size: t.count, fill: s.color, subjectName: s.name, exams: t.exams })
    }
    return [...groups.values()]
  }, [topics])

  return (
    <Card className="flex flex-col">
      <CardHeader
        icon={<LayoutGrid size={16} />}
        title="Ders × konu hata haritası"
        subtitle="Kutu büyüklüğü = yanlış sayısı, renk = ders"
      />
      <div className="px-3 pb-4 pt-2">
        {data.length === 0 ? (
          <p className="py-16 text-center text-xs text-muted">Gösterilecek konu bazlı hata kaydı yok.</p>
        ) : (
          <div className="h-[360px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <Treemap
                data={data}
                dataKey="size"
                nameKey="name"
                isAnimationActive={false}
                content={<Cell x={0} y={0} width={0} height={0} depth={0} name="" />}
              >
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const p = payload[0].payload as Partial<Leaf> & { name: string; value?: number }
                    if (!p.subjectName) return null
                    return (
                      <TipBox title={p.name}>
                        <div>{p.subjectName}</div>
                        <div className="tabular">
                          {p.size ?? p.value} yanlış · {p.exams} denemede
                        </div>
                      </TipBox>
                    )
                  }}
                />
              </Treemap>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </Card>
  )
}
