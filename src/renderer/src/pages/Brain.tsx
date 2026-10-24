import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Brain as BrainIcon, GitMerge, Loader2, Play, RefreshCw, Search, Sparkles, Undo2 } from 'lucide-react'
import type { BrainPlan } from '../../../shared/types'
import { Button, Input, Segmented, cn, confirm, toast } from '@/components/ui'
import { reviewQueue, skillDue, sortedSkills } from '@/lib/brain'
import { backfillSkills, consolidateBrain, needsApproval, notesNeedingSkills } from '@/lib/brainSync'
import { relativeDay } from '@/lib/date'
import { useNav } from '@/lib/nav'
import { useStore } from '@/lib/store'
import { NoteDetail } from '@/components/mistakes/NoteDetail'
import { BrainGraph } from '@/components/brain/BrainGraph'
import { PlanReview } from '@/components/brain/PlanReview'
import { SkillDetail } from '@/components/brain/SkillDetail'
import { SkillList } from '@/components/brain/SkillList'
import { SkillReview } from '@/components/brain/SkillReview'
import { fold, isCross, type SkillRow } from '@/components/brain/shared'

type Filter = 'all' | 'due' | 'zayif' | 'gelisiyor' | 'guclu' | 'cross'
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Tümü' },
  { id: 'due', label: 'Tekrar zamanı' },
  { id: 'zayif', label: 'Zayıf' },
  { id: 'gelisiyor', label: 'Gelişiyor' },
  { id: 'guclu', label: 'Oturdu' },
  { id: 'cross', label: 'Birden çok konu' }
]

/** Son birleştirme / silme / düzenlemeyi geri al */
function UndoButton(): React.JSX.Element | null {
  const undo = useStore((s) => s.data.brainMeta?.undo)
  if (!undo) return null
  return (
    <Button
      variant="ghost"
      size="sm"
      icon={<Undo2 size={13} />}
      title={`${undo.label} · ${relativeDay(undo.at.slice(0, 10))}`}
      onClick={async () => {
        if (
          await confirm({
            title: 'Geri alınsın mı?',
            message: `“${undo.label}” işleminden önceki hafızaya dönülür. O zamandan beri eklenen kanıtlar da geri gider.`,
            confirmText: 'Geri al',
            danger: false
          })
        ) {
          useStore.getState().undoBrain()
          toast('Geri alındı', 'info')
        }
      }}
    >
      Geri al
    </Button>
  )
}

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

function TidyButton({ onPlan }: { onPlan: (p: BrainPlan) => void }): React.JSX.Element | null {
  const count = useStore((s) => s.data.skills.length)
  const [busy, setBusy] = useState(false)
  if (count < 2) return null
  const run = async (): Promise<void> => {
    setBusy(true)
    try {
      const r = await consolidateBrain()
      if (!r) return
      const a = r.applied
      const parts = [a.prereqs && `${a.prereqs} önkoşul bağı`, a.areas && `${a.areas} alan`, a.described && `${a.described} tanım`].filter(Boolean)
      if (needsApproval(r.pending)) {
        if (parts.length) toast(`Eklendi: ${parts.join(', ')}`, 'info')
        onPlan(r.pending)
      } else toast(parts.length ? `Hafıza düzenlendi: ${parts.join(', ')}` : 'Hafıza zaten düzenli')
    } catch {
      toast('Hafıza düzenlenemedi', 'error')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={busy}
      icon={busy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
      onClick={() => void run()}
      title="AI beceriler arasındaki önkoşul bağlarını, alanları ve tanımları ekler; kopya birleştirme ve ad önerilerini onayına sunar"
    >
      {busy ? 'Düzenleniyor…' : 'Hafızayı düzenle'}
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
  const [review, setReview] = useState<string[] | null>(null)
  const [plan, setPlan] = useState<BrainPlan | null>(null)
  const pending = data.brainMeta?.pending
  const closeReview = useCallback(() => setReview(null), [])

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
      if (f && !fold(s.name + ' ' + (s.description ?? '') + ' ' + (s.area ?? '')).includes(f)) return false
      if (filter === 'cross') return isCross(s)
      if (filter === 'due') return skillDue(s)
      if (filter !== 'all') return s.strength.status === filter
      return true
    })
  }, [all, q, filter])

  const sel = all.find((s) => s.id === selected) ?? (view === 'liste' ? filtered[0] : undefined)
  const weak = all.filter((s) => s.strength.status === 'zayif').length
  const cross = all.filter(isCross).length
  const pendingNotes = notesNeedingSkills().length
  const queue = useMemo(() => reviewQueue(data, 5), [data])
  const dueCount = all.filter((s) => skillDue(s)).length

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
          <UndoButton />
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
          <div className="flex items-center gap-2">
            <UndoButton />
            <TidyButton onPlan={setPlan} />
            <SyncButton />
          </div>
        </div>

        {queue.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-accent/25 bg-accent/5 px-5 py-4">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">
                Bugünün beceri tekrarı · <span className="tabular">{queue.length}</span> beceri
                {dueCount > queue.length && <span className="font-normal text-muted"> (sırada {dueCount})</span>}
              </div>
              <p className="mt-1 truncate text-xs text-muted">
                {queue.map((s) => s.name).join(' · ')} — her biri için 2 yeni soru, kök nedenler önce.
              </p>
            </div>
            <Button variant="primary" icon={<Play size={14} />} onClick={() => setReview(queue.map((s) => s.id))}>
              Tekrara başla
            </Button>
          </div>
        )}

        {needsApproval(pending) && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-4 py-3 text-xs text-muted">
            <span className="inline-flex items-center gap-2">
              <GitMerge size={14} className="text-accent" />
              Hafıza düzenleme önerisi bekliyor:{' '}
              {[pending?.merge?.length && `${pending.merge.length} birleştirme`, pending?.rename?.length && `${pending.rename.length} yeni ad`].filter(Boolean).join(', ')}
            </span>
            <Button variant="outline" size="sm" onClick={() => setPlan(pending!)}>
              İncele
            </Button>
          </div>
        )}
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
                onReview={(id) => setReview([id])}
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

      {review && <SkillReview ids={review} onClose={closeReview} />}
      {plan && <PlanReview plan={plan} all={all} onClose={() => setPlan(null)} />}

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
