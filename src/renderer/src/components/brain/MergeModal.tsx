import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Input, Modal, cn } from '@/components/ui'
import { STATUS_COLOR } from '@/lib/brain'
import { fold, type SkillRow } from './shared'

/** Bir beceriyi başka bir becerinin içine birleştirmek için aranabilir seçici */
export function MergeModal({
  open,
  source,
  all,
  onClose,
  onPick
}: {
  open: boolean
  source: SkillRow
  all: SkillRow[]
  onClose: () => void
  onPick: (target: SkillRow) => void
}): React.JSX.Element | null {
  const [q, setQ] = useState('')
  const list = useMemo(() => {
    const f = fold(q.trim())
    return all.filter((s) => s.id !== source.id && (!f || fold(s.name).includes(f)))
  }, [all, source.id, q])
  return (
    <Modal open={open} onClose={onClose} title="Başka bir beceriyle birleştir" subtitle={`"${source.name}" kanıtlarıyla birlikte seçeceğin becerinin içine taşınır.`} width={480}>
      <div className="relative mb-3">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
        <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Beceri ara…" className="pl-9" />
      </div>
      <ul className="max-h-[320px] space-y-0.5 overflow-y-auto">
        {list.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onPick(s)}
              className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] transition-colors hover:bg-surface-2')}
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: STATUS_COLOR[s.strength.status] }} />
              <span className="flex-1">{s.name}</span>
              <span className="tabular text-[11px] text-subtle">{s.strength.score}</span>
            </button>
          </li>
        ))}
        {!list.length && <li className="py-8 text-center text-xs text-subtle">Eşleşen beceri yok.</li>}
      </ul>
    </Modal>
  )
}
