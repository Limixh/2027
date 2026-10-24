// Hafıza düzenleme önerileri: AI'nin önerdiği birleştirme ve yeniden adlandırmalar öğrencinin onayıyla uygulanır.
import { useState } from 'react'
import { ArrowRight, Check, GitMerge, PenLine } from 'lucide-react'
import type { BrainPlan } from '../../../../shared/types'
import { Button, Modal, cn, toast } from '@/components/ui'
import { STATUS_COLOR } from '@/lib/brain'
import { applyConsolidation } from '@/lib/brainSync'
import { useStore } from '@/lib/store'
import type { SkillRow } from './shared'

function Tick({ on, onClick }: { on: boolean; onClick: () => void }): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors',
        on ? 'border-accent bg-accent text-on-accent' : 'border-subtle/60 hover:border-text'
      )}
    >
      {on && <Check size={12} strokeWidth={3} />}
    </button>
  )
}

export function PlanReview({ plan, all, onClose }: { plan: BrainPlan; all: SkillRow[]; onClose: () => void }): React.JSX.Element {
  const byId = (id: string): SkillRow | undefined => all.find((s) => s.id === id)
  // Hafıza bu arada değiştiyse artık olmayan becerilere ait öneriler gösterilmez
  const merges = (plan.merge ?? []).map((m) => ({ ...m, from: m.from.filter((f) => byId(f)) })).filter((m) => byId(m.into) && m.from.length)
  const renames = (plan.rename ?? []).filter((r) => byId(r.id))
  const [mOn, setMOn] = useState(() => merges.map(() => true))
  const [rOn, setROn] = useState(() => renames.map(() => true))
  const chosen = mOn.filter(Boolean).length + rOn.filter(Boolean).length

  const dismiss = (): void => {
    useStore.getState().setBrainMeta({ pending: undefined })
    onClose()
  }
  const apply = (): void => {
    const r = applyConsolidation({ merge: merges.filter((_, i) => mOn[i]), rename: renames.filter((_, i) => rOn[i]) })
    useStore.getState().setBrainMeta({ pending: undefined })
    const parts = [r.merged && `${r.merged} birleştirme`, r.renamed && `${r.renamed} yeni ad`].filter(Boolean)
    toast(parts.length ? `Uygulandı: ${parts.join(', ')} · geri alabilirsin` : 'Değişiklik yapılmadı')
    onClose()
  }

  const Chip = ({ id }: { id: string }): React.JSX.Element => {
    const s = byId(id)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-xs text-text">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: s ? STATUS_COLOR[s.strength.status] : undefined }} />
        {s?.name ?? id}
        {s && <span className="tabular text-subtle">· {s.evidence.length} kanıt</span>}
      </span>
    )
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Hafıza düzenleme önerisi"
      subtitle="AI aynı beceriyi anlatan kopyaları ve belirsiz adları buldu. Uygun olanları seç; sonra istersen geri alabilirsin."
      width={680}
      footer={
        <>
          <Button variant="ghost" className="mr-auto" onClick={dismiss}>
            Hiçbirini uygulama
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Sonra
          </Button>
          <Button variant="primary" disabled={!chosen} onClick={apply}>
            Seçilenleri uygula ({chosen})
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {merges.length > 0 && (
          <section>
            <h3 className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-subtle">
              <GitMerge size={12} /> Birleştir
            </h3>
            <ul className="space-y-3">
              {merges.map((m, i) => (
                <li key={i} className="flex gap-3">
                  <Tick on={mOn[i]} onClick={() => setMOn((v) => v.map((x, j) => (j === i ? !x : x)))} />
                  <div className={cn('min-w-0 flex-1 transition-opacity', !mOn[i] && 'opacity-50')}>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {m.from.map((f) => (
                        <Chip key={f} id={f} />
                      ))}
                      <ArrowRight size={13} className="text-subtle" />
                      <Chip id={m.into} />
                    </div>
                    {m.reason && <p className="mt-1.5 text-xs text-muted">{m.reason}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
        {renames.length > 0 && (
          <section>
            <h3 className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-subtle">
              <PenLine size={12} /> Yeni ad
            </h3>
            <ul className="space-y-2.5">
              {renames.map((r, i) => (
                <li key={r.id} className="flex gap-3">
                  <Tick on={rOn[i]} onClick={() => setROn((v) => v.map((x, j) => (j === i ? !x : x)))} />
                  <div className={cn('min-w-0 flex-1 text-sm transition-opacity', !rOn[i] && 'opacity-50')}>
                    <span className="text-muted line-through decoration-subtle/60">{byId(r.id)?.name}</span>
                    <ArrowRight size={12} className="mx-2 inline text-subtle" />
                    <span className="font-medium text-text">{r.name}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
        {!merges.length && !renames.length && <p className="text-sm text-muted">Öneriler artık geçerli değil (beceriler değişmiş).</p>}
      </div>
    </Modal>
  )
}
