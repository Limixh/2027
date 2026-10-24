import { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { AlertTriangle, GitMerge, Play, Plus, Trash2, X } from 'lucide-react'
import { SUBJECT_MAP } from '@/data/curriculum'
import { Button, Input, Segmented, Select, confirm, cn } from '@/components/ui'
import { dependents, rootCauses, skillDue, STATUS_COLOR, STATUS_LABEL } from '@/lib/brain'
import { formatDate, relativeDay, todayKey } from '@/lib/date'
import { useNav } from '@/lib/nav'
import { useStore } from '@/lib/store'
import { NoteImage } from '@/components/mistakes/NoteImage'
import type { SkillEvidence } from '../../../../shared/types'
import { Lesson } from './Lesson'
import { MergeModal } from './MergeModal'
import { Sparkline } from './Sparkline'
import { KIND_META, groupTopics, strengthHistory, topicShort, type SkillRow } from './shared'

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }): React.JSX.Element {
  return (
    <section className="border-t border-border py-6">
      <div className="mb-4 flex min-h-[24px] items-center justify-between gap-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  )
}

/** Tıklayınca yazılabilen, sade başlık */
function InlineText({
  value,
  onSave,
  placeholder,
  className,
  multiline
}: {
  value: string
  onSave: (v: string) => void
  placeholder?: string
  className?: string
  multiline?: boolean
}): React.JSX.Element {
  const [v, setV] = useState(value)
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => setV(value), [value])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = el.scrollHeight + 'px'
  }, [v])
  const commit = (): void => {
    const t = v.trim()
    if (!multiline && !t) return setV(value)
    if (t !== value) onSave(t)
  }
  return (
    <textarea
      ref={ref}
      rows={1}
      value={v}
      placeholder={placeholder}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !(multiline && e.shiftKey)) {
          e.preventDefault()
          ;(e.target as HTMLTextAreaElement).blur()
        }
        if (e.key === 'Escape') {
          setV(value)
          ;(e.target as HTMLTextAreaElement).blur()
        }
      }}
      className={cn(
        'block w-full resize-none overflow-hidden rounded-md border border-transparent bg-transparent px-2 py-0.5 -mx-2 outline-none transition-colors placeholder:text-subtle hover:border-border focus:border-border focus:bg-surface-2/50',
        className
      )}
    />
  )
}

function NoteLink({ noteId, onOpen }: { noteId: string; onOpen: (id: string) => void }): React.JSX.Element | null {
  const note = useStore((s) => s.data.mistakeNotes.find((m) => m.id === noteId))
  if (!note) return null
  const img = note.questionImages?.[0] ?? note.attemptImages?.[0]
  return (
    <button
      type="button"
      onClick={() => onOpen(noteId)}
      className="mt-2 flex w-full max-w-md items-center gap-3 rounded-lg border border-border p-1.5 pr-3 text-left transition-colors hover:bg-surface-2"
    >
      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-md bg-surface-2">
        {img ? (
          <NoteImage att={img} className="h-full w-full" imgClassName="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center text-[10px] text-subtle">Not</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="line-clamp-2 text-xs leading-snug text-muted">{note.text || 'Soru notu'}</div>
      </div>
    </button>
  )
}

function EvidenceForm({ skill, onDone }: { skill: SkillRow; onDone: () => void }): React.JSX.Element {
  const add = useStore((s) => s.addSkillEvidence)
  const [kind, setKind] = useState<SkillEvidence['kind']>('eksik')
  const [detail, setDetail] = useState('')
  const [topicId, setTopicId] = useState('')
  const submit = (): void => {
    add(skill.id, { date: todayKey(), kind, detail: detail.trim() || undefined, topicId: topicId || undefined, source: 'manuel' })
    onDone()
  }
  return (
    <div className="mb-5 space-y-3 rounded-xl border border-border p-4">
      <Segmented
        size="sm"
        value={kind}
        onChange={setKind}
        options={[
          { value: 'eksik', label: 'Eksik' },
          { value: 'zayif', label: 'Zorlandı' },
          { value: 'basari', label: 'Başarılı' }
        ]}
      />
      <Input autoFocus value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Ne oldu? (ör. Yok etme yaparken işaret hatası yaptım)" onKeyDown={(e) => e.key === 'Enter' && submit()} />
      {skill.topicIds.length > 0 && (
        <Select value={topicId} onChange={(e) => setTopicId(e.target.value)}>
          <option value="">Konu belirtme</option>
          {skill.topicIds.map((t) => (
            <option key={t} value={t}>
              {topicShort(t)}
            </option>
          ))}
        </Select>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onDone}>
          Vazgeç
        </Button>
        <Button variant="primary" size="sm" onClick={submit}>
          Ekle
        </Button>
      </div>
    </div>
  )
}

function SkillChip({ s, onClick, onRemove }: { s: SkillRow; onClick: () => void; onRemove?: () => void }): React.JSX.Element {
  return (
    <span className="group inline-flex items-center rounded-full border border-border text-xs transition-colors hover:bg-surface-2">
      <button type="button" onClick={onClick} className="inline-flex items-center gap-1.5 py-1 pl-2.5 pr-2.5 text-text">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLOR[s.strength.status] }} />
        {s.name}
        <span className="tabular text-subtle">{s.strength.score}</span>
      </button>
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label="Bağı kaldır" className="-ml-1 mr-1.5 hidden rounded p-0.5 text-subtle hover:text-danger group-hover:block">
          <X size={11} />
        </button>
      )}
    </span>
  )
}

/** Önkoşullar (bu beceri neye dayanıyor) ve bu beceriye dayananlar */
function Foundations({ skill, all, onSelect }: { skill: SkillRow; all: SkillRow[]; onSelect: (id: string) => void }): React.JSX.Element {
  const update = useStore((s) => s.updateSkill)
  const [adding, setAdding] = useState(false)
  const prereqs = (skill.prereqIds ?? []).map((id) => all.find((s) => s.id === id)).filter((s): s is SkillRow => !!s)
  const deps = dependents(skill, all)
  // Döngü kurmasın: zaten bu beceriye dayananlar önkoşul yapılamaz
  const candidates = all.filter((s) => s.id !== skill.id && !skill.prereqIds?.includes(s.id) && !s.prereqIds?.includes(skill.id))
  return (
    <Section
      title="Temeller ve bağlantılar"
      right={
        !adding &&
        candidates.length > 0 && (
          <Button variant="ghost" size="sm" icon={<Plus size={13} />} onClick={() => setAdding(true)}>
            Önkoşul ekle
          </Button>
        )
      }
    >
      {adding && (
        <Select
          autoFocus
          className="mb-4 max-w-md"
          value=""
          onChange={(e) => {
            if (e.target.value) update(skill.id, { prereqIds: [...(skill.prereqIds ?? []), e.target.value] })
            setAdding(false)
          }}
          onBlur={() => setAdding(false)}
        >
          <option value="">Bu beceri hangisine dayanıyor?</option>
          {candidates.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      )}
      <div className="space-y-4 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-[150px] shrink-0 text-muted">Dayandığı beceriler</span>
          {prereqs.length ? (
            prereqs.map((p) => (
              <SkillChip
                key={p.id}
                s={p}
                onClick={() => onSelect(p.id)}
                onRemove={() => update(skill.id, { prereqIds: skill.prereqIds?.filter((x) => x !== p.id) })}
              />
            ))
          ) : (
            <span className="text-subtle">Henüz yok — “Hafızayı düzenle” AI ile bulur ya da elle ekle.</span>
          )}
        </div>
        {deps.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-[150px] shrink-0 text-muted">Buna dayananlar</span>
            {deps.map((d) => (
              <SkillChip key={d.id} s={d} onClick={() => onSelect(d.id)} />
            ))}
          </div>
        )}
      </div>
    </Section>
  )
}

function MyNote({ skill }: { skill: SkillRow }): React.JSX.Element {
  const update = useStore((s) => s.updateSkill)
  const [text, setText] = useState(skill.note ?? '')
  const [mode, setMode] = useState<'yaz' | 'onizle'>('yaz')
  const saved = useRef(skill.note ?? '')
  const save = (v: string): void => {
    if (v !== saved.current) {
      saved.current = v
      update(skill.id, { note: v })
    }
  }
  useEffect(() => {
    const t = setTimeout(() => save(text), 700)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])
  return (
    <Section
      title="Notlarım"
      right={
        <Segmented
          size="sm"
          value={mode}
          onChange={(m) => {
            save(text)
            setMode(m)
          }}
          options={[
            { value: 'yaz', label: 'Yaz' },
            { value: 'onizle', label: 'Önizleme' }
          ]}
        />
      }
    >
      {mode === 'yaz' ? (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => save(text)}
          placeholder="Bu beceri için kendi ipuçların, formüllerin, hatırlatmaların… (Markdown destekli)"
          className="input min-h-[132px] w-full resize-y text-[13px] leading-relaxed"
        />
      ) : text.trim() ? (
        <div className="prose-ai">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
        </div>
      ) : (
        <p className="text-xs text-subtle">Henüz not yok.</p>
      )}
    </Section>
  )
}

export function SkillDetail({
  skill,
  all,
  onOpenNote,
  onChanged,
  onReview
}: {
  skill: SkillRow
  all: SkillRow[]
  onOpenNote: (id: string) => void
  /** Silme/birleştirme sonrası seçimi güncellemek için */
  onChanged: (nextId?: string) => void
  /** Bu beceriyi şimdi tekrar et */
  onReview: (id: string) => void
}): React.JSX.Element {
  const update = useStore((s) => s.updateSkill)
  const remove = useStore((s) => s.deleteSkill)
  const merge = useStore((s) => s.mergeSkills)
  const go = useNav((s) => s.go)
  const [adding, setAdding] = useState(false)
  const [merging, setMerging] = useState(false)
  const color = STATUS_COLOR[skill.strength.status]
  const history = useMemo(() => strengthHistory(skill), [skill])
  const groups = useMemo(() => groupTopics(skill), [skill])
  const evidence = useMemo(
    () => skill.evidence.slice().sort((a, b) => b.date.localeCompare(a.date)),
    [skill.evidence]
  )
  const roots = useMemo(() => rootCauses(skill, all), [skill, all])
  const today = todayKey()
  const due = skillDue(skill, today)

  const onDelete = async (): Promise<void> => {
    if (await confirm({ title: 'Beceri silinsin mi?', message: `"${skill.name}" ve kanıtları silinir. Sorulardaki bağlantısı da kalkar.`, confirmText: 'Sil', danger: true })) {
      remove(skill.id)
      onChanged()
    }
  }

  return (
    <article className="min-w-0 pb-16">
      {/* Başlık */}
      <div className="pb-6">
        <InlineText
          value={skill.area ?? ''}
          placeholder="Alan ekle (ör. Cebir)"
          onSave={(v) => update(skill.id, { area: v || undefined })}
          className="mb-1 text-[11px] font-medium uppercase tracking-wider text-subtle"
        />
        <InlineText value={skill.name} onSave={(v) => update(skill.id, { name: v })} className="text-[26px] font-semibold leading-tight tracking-tight" />
        <div className="mt-1">
          <InlineText
            multiline
            value={skill.description ?? ''}
            placeholder="Kısa bir tanım ekle…"
            onSave={(v) => update(skill.id, { description: v || undefined })}
            className="text-sm leading-relaxed text-muted"
          />
        </div>

        {roots.length > 0 && (
          <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning/5 px-3.5 py-2.5 text-[13px] leading-relaxed">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-warning" />
            <span className="text-muted">
              Kök neden olabilir: bu beceri{' '}
              {roots.map((r, i) => (
                <span key={r.id}>
                  {i > 0 && ', '}
                  <button type="button" className="font-medium text-text underline decoration-warning/50 underline-offset-2 hover:decoration-warning" onClick={() => onChanged(r.id)}>
                    {r.name}
                  </button>{' '}
                  <span className="tabular text-subtle">({r.strength.score})</span>
                </span>
              ))}{' '}
              becerisine dayanıyor ve o henüz oturmadı. Önce onu güçlendirmek bu beceriyi de kolaylaştırır.
            </span>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
          <div className="flex items-end gap-5">
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="tabular text-4xl font-semibold leading-none tracking-tight" style={{ color }}>
                  {skill.strength.score}
                </span>
                <span className="text-xs text-subtle">/ 100</span>
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-muted">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
                {STATUS_LABEL[skill.strength.status]}
              </div>
            </div>
            <div className="pb-0.5">
              <Sparkline points={history} status={skill.strength.status} />
            </div>
          </div>
          <dl className="tabular flex gap-8 text-xs">
            {[
              ['Eksik / zorlanma', skill.strength.misses],
              ['Başarı', skill.strength.wins],
              ['Son', skill.strength.lastSeen ? relativeDay(skill.strength.lastSeen) : '—'],
              ['Sonraki tekrar', due ? 'Bugün' : skill.nextReview ? formatDate(skill.nextReview, false) : '—']
            ].map(([k, v]) => (
              <div key={k as string}>
                <dt className="text-subtle">{k}</dt>
                <dd className={cn('mt-1 text-sm font-medium text-text', k === 'Sonraki tekrar' && due && 'text-warning')}>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="mt-5">
          <Button variant={due ? 'primary' : 'outline'} size="sm" icon={<Play size={13} />} onClick={() => onReview(skill.id)}>
            {due ? 'Şimdi tekrar et' : 'Yine de tekrar et'}
          </Button>
        </div>
      </div>

      {/* Nerelerde çıktı */}
      <Section title="Nerelerde çıktı" right={groups.length > 1 ? <span className="text-[11px] text-accent">{groups.length} farklı derste</span> : undefined}>
        {groups.length ? (
          <div className="space-y-3">
            {groups.map((g) => {
              const sub = SUBJECT_MAP[g.subjectId]
              return (
                <div key={g.subjectId} className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="flex w-[150px] shrink-0 items-center gap-2 text-xs text-muted">
                    <span className="h-2 w-2 rounded-full" style={{ background: sub?.color }} />
                    <span className="truncate">{sub ? `${sub.exam} ${sub.name}` : g.subjectId}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {g.topics.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => go('topics', { subject: g.subjectId, exam: sub?.exam })}
                        className="rounded-full border border-border px-2.5 py-1 text-xs text-text transition-colors hover:border-accent/50 hover:bg-accent/5"
                      >
                        {t.name}
                        {t.count > 0 && <span className="tabular ml-1.5 text-subtle">{t.count}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-xs text-subtle">Bir konuya bağlı kanıt eklendiğinde burada görünür.</p>
        )}
      </Section>

      <Foundations skill={skill} all={all} onSelect={(id) => onChanged(id)} />

      {/* Kanıtlar */}
      <Section
        title={`Kanıtlar · ${evidence.length}`}
        right={
          !adding && (
            <Button variant="ghost" size="sm" icon={<Plus size={13} />} onClick={() => setAdding(true)}>
              Kanıt ekle
            </Button>
          )
        }
      >
        {adding && <EvidenceForm skill={skill} onDone={() => setAdding(false)} />}
        {evidence.length ? (
          <ol className="relative ml-[5px] border-l border-border">
            {evidence.map((e) => {
              const m = KIND_META[e.kind]
              return (
                <li key={e.id} className="relative pb-6 pl-6 last:pb-0">
                  <span className="absolute -left-[5px] top-[5px] h-[9px] w-[9px] rounded-full ring-4 ring-bg" style={{ background: m.color }} />
                  <div className="flex flex-wrap items-center gap-x-2 text-xs">
                    <span className="font-medium" style={{ color: m.color }}>
                      {m.label}
                    </span>
                    <span className="text-subtle">·</span>
                    <span className="tabular text-muted">{formatDate(e.date, false)}</span>
                    {e.topicId && (
                      <>
                        <span className="text-subtle">·</span>
                        <span className="text-muted">{topicShort(e.topicId)}</span>
                      </>
                    )}
                    {e.source === 'manuel' && <span className="text-subtle">· elle eklendi</span>}
                    {e.source === 'tekrar' && <span className="text-subtle">· soru tekrarı</span>}
                    {e.source === 'beceri' && <span className="text-subtle">· beceri tekrarı</span>}
                    {e.source === 'pratik' && <span className="text-subtle">· mini ders pratiği</span>}
                  </div>
                  {e.detail && <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-text">{e.detail}</p>}
                  {e.noteId && <NoteLink noteId={e.noteId} onOpen={onOpenNote} />}
                </li>
              )
            })}
          </ol>
        ) : (
          <p className="text-xs text-subtle">Henüz kanıt yok.</p>
        )}
      </Section>

      <MyNote key={skill.id} skill={skill} />

      <Section title="Mini ders ve pratik">
        <Lesson key={skill.id} skill={skill} />
      </Section>

      <Section title="Yönet">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" icon={<GitMerge size={13} />} onClick={() => setMerging(true)} disabled={all.length < 2}>
            Başka beceriyle birleştir
          </Button>
          <Button variant="ghost" size="sm" className="text-danger hover:bg-danger/10" icon={<Trash2 size={13} />} onClick={() => void onDelete()}>
            Sil
          </Button>
        </div>
      </Section>

      <MergeModal
        open={merging}
        source={skill}
        all={all}
        onClose={() => setMerging(false)}
        onPick={async (target) => {
          if (await confirm({ title: 'Birleştirilsin mi?', message: `"${skill.name}", "${target.name}" içine taşınacak. Sonra geri alabilirsin.`, confirmText: 'Birleştir' })) {
            useStore.getState().snapshotBrain(`"${skill.name}" birleştirildi`)
            merge(target.id, skill.id)
            setMerging(false)
            onChanged(target.id)
          }
        }}
      />
    </article>
  )
}
