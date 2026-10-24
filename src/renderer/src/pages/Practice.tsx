import { Gauge, Timer } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { PracticeSet } from '../../../shared/types'
import { PracticeForm, fromPractice, initialValues, type PracticeValues } from '@/components/practice/PracticeForm'
import { PracticeHistory } from '@/components/practice/PracticeHistory'
import { PracticeStats } from '@/components/practice/PracticeStats'
import { LivePanel } from '@/components/practice/LivePanel'
import { isParagraf, lsGet, lsSet, useLive } from '@/components/practice/lib'
import { Modal, PageHeader, Segmented, confirm, toast } from '@/components/ui'
import { SUBJECT_MAP } from '@/data/curriculum'
import { formatDate } from '@/lib/date'
import { useStore } from '@/lib/store'

type Mode = 'quick' | 'live'

export default function Practice(): React.JSX.Element {
  const sets = useStore((s) => s.data.practiceSets)
  const addPracticeSet = useStore((s) => s.addPracticeSet)
  const updatePracticeSet = useStore((s) => s.updatePracticeSet)
  const deletePracticeSet = useStore((s) => s.deletePracticeSet)
  const livePhase = useLive((s) => s.phase)

  const [mode, setMode] = useState<Mode>(livePhase !== 'idle' ? 'live' : 'quick')
  const [filter, setFilter] = useState<string>('paragraf')
  const [editing, setEditing] = useState<PracticeSet | undefined>()
  const [formKey, setFormKey] = useState(0)

  const last = useMemo(() => lsGet<{ subjectId?: string; topicId?: string; source?: string }>('yks-practice-last', {}), [formKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const chips = useMemo(() => {
    const ids = [...new Set(sets.map((s) => s.subjectId))].filter((id) => SUBJECT_MAP[id])
    return [
      { id: 'paragraf', label: 'Paragraf' },
      { id: 'all', label: 'Tümü' },
      ...ids.map((id) => ({ id, label: `${SUBJECT_MAP[id].exam} ${SUBJECT_MAP[id].short}` }))
    ]
  }, [sets])

  const filtered = useMemo(
    () => sets.filter((s) => (filter === 'all' ? true : filter === 'paragraf' ? isParagraf(s) : s.subjectId === filter)),
    [sets, filter]
  )

  const save = (v: PracticeValues): void => {
    addPracticeSet(v)
    lsSet('yks-practice-last', { subjectId: v.subjectId, topicId: v.topicId, source: v.source })
    toast(`${v.count} soru kaydedildi`)
    setFormKey((k) => k + 1)
  }

  const remove = async (s: PracticeSet): Promise<void> => {
    const ok = await confirm({
      title: 'Set silinsin mi?',
      message: `${formatDate(s.date)} tarihli ${s.count} soruluk kayıt (ve bağlı çalışma süresi) silinecek.`,
      danger: true
    })
    if (ok) {
      deletePracticeSet(s.id)
      toast('Set silindi', 'info')
    }
  }

  return (
    <div className="mx-auto max-w-[1100px] pb-16">
      <PageHeader title="Soru Pratiği" description="Soru sayını, süreni ve doğru / yanlış / boşunu kaydet; soru başına hızını takip et." />

      {/* Giriş */}
      <section>
        <div className="mb-4">
          <Segmented<Mode>
            value={mode}
            onChange={setMode}
            options={[
              { value: 'quick', label: 'Hızlı giriş', icon: <Gauge size={14} /> },
              { value: 'live', label: 'Canlı ölç', icon: <Timer size={14} /> }
            ]}
          />
        </div>
        {mode === 'quick' ? (
          <PracticeForm key={formKey} inline initial={initialValues(last)} submitLabel="Kaydet" onSubmit={save} />
        ) : (
          <LivePanel />
        )}
      </section>

      {sets.length === 0 ? (
        <div className="mt-14 border-t border-border py-14 text-center">
          <div className="text-sm font-medium text-text">Henüz soru pratiği yok</div>
          <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-muted">
            Yukarıdan “20 soru, 28 dakika, 17 doğru 2 yanlış” gibi bir set ekle ya da “Canlı ölç” ile her sorunun süresini anında ölç.
            İlerleme grafikleri ve geçmiş burada görünecek.
          </p>
        </div>
      ) : (
        <>
          <section className="mt-12 border-t border-border pt-8">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold tracking-tight">İlerleme</h2>
              <div className="flex flex-wrap gap-1.5">
                {chips.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setFilter(c.id)}
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      filter === c.id ? 'border-accent bg-accent/10 text-text' : 'border-border text-muted hover:text-text'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <PracticeStats sets={filtered} />
          </section>

          <section className="mt-12 border-t border-border pt-8">
            <h2 className="mb-4 text-base font-semibold tracking-tight">Geçmiş</h2>
            {filtered.length === 0 ? (
              <p className="text-sm text-muted">Bu filtre için kayıt yok.</p>
            ) : (
              <PracticeHistory sets={filtered} onEdit={setEditing} onDelete={remove} />
            )}
          </section>
        </>
      )}

      <Modal open={!!editing} onClose={() => setEditing(undefined)} title="Seti düzenle" width={640}>
        {editing && (
          <PracticeForm
            initial={fromPractice(editing)}
            submitLabel="Güncelle"
            onCancel={() => setEditing(undefined)}
            onSubmit={(v) => {
              updatePracticeSet(editing.id, v)
              setEditing(undefined)
              toast('Set güncellendi')
            }}
          />
        )}
      </Modal>
    </div>
  )
}
