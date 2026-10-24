import { useEffect, useMemo, useRef, useState } from 'react'
import { Brain as BrainIcon, Loader2, RefreshCw, Search } from 'lucide-react'
import { Button, Input, Segmented, cn, confirm, toast } from '@/components/ui'
import { sortedSkills } from '@/lib/brain'
import { backfillSkills, notesNeedingSkills } from '@/lib/brainSync'
import { useNav } from '@/lib/nav'
import { useStore } from '@/lib/store'
import { NoteDetail } from '@/components/mistakes/NoteDetail'
import { BrainGraph } from '@/components/brain/BrainGraph'
import { SkillDetail } from '@/components/brain/SkillDetail'
import { SkillList } from '@/components/brain/SkillList'
import { fold, isCross, type SkillRow } from '@/components/brain/shared'

type Filter = 'all' | 'zayif' | 'gelisiyor' | 'guclu' | 'cross'
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Tümü' },
  { id: 'zayif', label: 'Zayıf' },
  { id: 'gelisiyor', label: 'Gelişiyor' },
  { id: 'guclu', label: 'Oturdu' },
  { id: 'cross', label: 'Birden çok konu' }
]

function SyncButton({ prominent }: { prominent?: boolean }): React.JSX.Element | null {
  const notes = useStore((s) => s.data.mistakeNotes)
  const skills = useStore((s) => s.data.skills)
  const [prog, setProg] = useState<{ done: number; total: number } | null>(null)
  const sig = useRef({ stop: false })
  // notes / skills değişince yeniden say
  const pending = useMemo(() => notesNeedingSkills().length, [notes, skills]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!pending && !prog) return null
  const run = async (): Promise<void> => {
    sig.current = { stop: false }
    setProg({ done: 0, total: pending })
    try {
      const n = await backfillSkills((done, total) => setProg({ done, total }), sig.current)
      toast(sig.current.stop ? `${n} soru işlendi, durduruldu` : `Hafıza güncellendi (${n} soru)`)
    } catch {
      toast('Hafıza güncellenemedi', 'error')
    } finally {
      setProg(null)
    }
  }
  if (prog)
    return (
      <div className="flex items-center gap-3 text-xs text-muted">
        <Loader2 size={13} className="animate-spin" />
        <span className="tabular">{prog.done}/{prog.total} işlendi…</span>
        <Button variant="ghost" size="sm" onClick={() => (sig.current.stop = true)}>
          Durdur
        </Button>
      </div>
    )
  return (
    <Button variant={prominent ? 'primary' : 'outline'} size={prominent ? 'md' : 'sm'} icon={<RefreshCw size={13} />} onClick={() => void run()}>
      Hafızayı güncelle ({pending} soru)
    </Button>
  )
}

export default function Brain(): React.JSX.Element {
  const data = useStore((s) => s.data)
  const removeNote = useStore((s) => s.deleteMistakeNote)
  const go = useNav((s) => s.go)
  const paramSkill = useNav((s) => s.params.skill)
  const [view, setView] = useState<'liste' | 'harita'>('liste')
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<string | undefined>(typeof paramSkill === 'string' ? paramSkill : undefined)
  const [noteId, setNoteId] = useState<string | null>(null)

  useEffect(() => {
    if (typeof paramSkill === 'string') {
      setSelected(paramSkill)
      setView('liste')
    }
  }, [paramSkill])

  const all = useMemo<SkillRow[]>(() => sortedSkills(data), [data])
  const filtered = useMemo(() => {
    const f = fold(q.trim())
    return all.filter((s) => {
      if (f && !fold(s.name + ' ' + (s.description ?? '')).includes(f)) return false
      if (filter === 'cross') return isCross(s)
      if (filter !== 'all') return s.strength.status === filter
      return true
    })
  }, [all, q, filter])

  const sel = all.find((s) => s.id === selected) ?? (view === 'liste' ? filtered[0] : undefined)
  const weak = all.filter((s) => s.strength.status === 'zayif').length
  const cross = all.filter(isCross).length
  const pendingNotes = notesNeedingSkills().length

  if (!all.length) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center pb-20 pt-[12vh] text-center">
        <BrainIcon size={28} strokeWidth={1.4} className="text-subtle" />
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">İkinci Beyin</h1>
        <p className="mt-2 text-sm text-muted">Hatalarından öğrenilen beceriler burada birikir.</p>
        <ol className="mt-8 space-y-3 text-left text-[13px] leading-relaxed text-muted">
          {[
            <>Hata Defteri’ne bir soru ekle ve <b className="font-medium text-text">“AI ile analiz et”</b>’e bas.</>,
            <>Beceriler (ör. “Denklem sisteminde yok etme yöntemi”) otomatik çıkar.</>,
            <>Farklı konulardaki aynı eksikler tek beceride birleşir; kök nedeni görürsün.</>
          ].map((t, i) => (
            <li key={i} className="flex gap-3">
              <span className="tabular mt-0.5 w-4 shrink-0 text-subtle">{i + 1}</span>
              <span>{t}</span>
            </li>
          ))}
        </ol>
        <div className="mt-9 flex items-center gap-3">
          {pendingNotes > 0 && <SyncButton prominent />}
          <Button variant={pendingNotes > 0 ? 'ghost' : 'primary'} onClick={() => go('mistakes')}>
            Hata Defteri’ne git
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <header className="pb-6 pt-2">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">İkinci Beyin</h1>
            <p className="mt-1 text-sm text-muted">Hatalarından öğrenilen beceriler; farklı konulardaki aynı eksikler burada birleşir.</p>
            <p className="tabular mt-2 text-xs text-subtle">
              {all.length} beceri · {weak} zayıf · {cross} farklı konuya yayılan
            </p>
          </div>
          <SyncButton />
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-border pb-4">
          <Segmented
            size="sm"
            value={view}
            onChange={setView}
            options={[
              { value: 'liste', label: 'Liste' },
              { value: 'harita', label: 'Harita' }
            ]}
          />
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs transition-colors',
                  filter === f.id ? 'bg-text text-bg' : 'text-muted hover:bg-surface-2 hover:text-text'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative ml-auto w-56">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Beceri ara…" className="h-8 pl-8 text-xs" />
          </div>
        </div>
      </header>

      {view === 'liste' ? (
        <div className="grid grid-cols-[320px_minmax(0,1fr)] gap-10">
          <aside className="sticky top-14 max-h-[calc(100vh-4.5rem)] self-start overflow-y-auto pr-2">
            <SkillList skills={filtered} selectedId={sel?.id} onSelect={setSelected} />
          </aside>
          <div className="min-w-0">
            {sel ? (
              <SkillDetail
                key={sel.id}
                skill={sel}
                all={all}
                onOpenNote={setNoteId}
                onChanged={(next) => setSelected(next)}
              />
            ) : (
              <p className="py-20 text-center text-sm text-subtle">Soldan bir beceri seç.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="h-[calc(100vh-17rem)] min-h-[460px]">
          <BrainGraph
            skills={filtered}
            selectedId={sel?.id}
            onSelect={setSelected}
            onOpen={(id) => {
              setSelected(id)
              setView('liste')
            }}
          />
        </div>
      )}

      {noteId && (
        <NoteDetail
          id={noteId}
          onClose={() => setNoteId(null)}
          onEdit={() => {
            setNoteId(null)
            go('mistakes')
          }}
          onDelete={async (n) => {
            if (await confirm({ title: 'Soru silinsin mi?', confirmText: 'Sil', danger: true })) {
              removeNote(n.id)
              setNoteId(null)
            }
          }}
        />
      )}
    </div>
  )
}
