import { Pause, Play, RotateCcw, Square, Undo2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { SubjectSelect, TopicSelect } from '@/components/study/SubjectSelect'
import { Button, Field, Input, NumberInput, toast } from '@/components/ui'
import { SUBJECT_MAP, TOPIC_MAP } from '@/data/curriculum'
import { useStore } from '@/lib/store'
import { useTicker } from '@/lib/clocks'
import { QuestionChart } from './QuestionChart'
import {
  DEFAULT_SUBJECT,
  RES_COLOR,
  RES_LABEL,
  curMs,
  fmtClock,
  fmtDur,
  fmtNum,
  lsGet,
  lsSet,
  netOf,
  paragrafTopicId,
  useLive,
  type Res
} from './lib'

const RESULTS: { r: Res; keys: string[]; hint: string }[] = [
  { r: 'D', keys: ['d', '1'], hint: 'D' },
  { r: 'Y', keys: ['y', '2'], hint: 'Y' },
  { r: 'B', keys: ['b', '3'], hint: 'B' },
  { r: 'C', keys: ['c', 'ç', '4'], hint: 'Ç' }
]

const fmtMs = (ms: number): string => {
  const t = Math.floor(ms / 1000)
  const m = Math.floor(t / 60)
  const s = t % 60
  const cs = Math.floor((ms % 1000) / 100)
  return `${m}:${String(s).padStart(2, '0')}.${cs}`
}

export function LivePanel(): React.JSX.Element {
  const live = useLive()
  useTicker(live.phase === 'running', 100)

  /* ---------- hazırlık ---------- */
  const last = useMemo(() => lsGet<{ subjectId?: string; topicId?: string }>('yks-practice-last', {}), [])
  const [subjectId, setSubjectId] = useState(last.subjectId && SUBJECT_MAP[last.subjectId] ? last.subjectId : DEFAULT_SUBJECT)
  const [topicId, setTopicId] = useState<string | undefined>(last.subjectId ? last.topicId : paragrafTopicId())
  const [planned, setPlanned] = useState(0)
  const [source, setSource] = useState('')

  /* ---------- klavye ---------- */
  useEffect(() => {
    if (live.phase !== 'running' && live.phase !== 'paused') return
    const onKey = (e: KeyboardEvent): void => {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const k = e.key.toLowerCase()
      if (k === ' ') {
        e.preventDefault()
        if (useLive.getState().phase === 'running') useLive.getState().pause()
        else useLive.getState().resume()
        return
      }
      const hit = RESULTS.find((x) => x.keys.includes(k))
      if (hit) {
        e.preventDefault()
        useLive.getState().answer(hit.r)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [live.phase])

  const topicName = live.topicId ? TOPIC_MAP[live.topicId]?.name : undefined
  const subjName = SUBJECT_MAP[live.subjectId]?.name

  /* ---------- 1) başlangıç ---------- */
  if (live.phase === 'idle') {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-12">
          <Field label="Ders" className="lg:col-span-3">
            <SubjectSelect value={subjectId} onChange={(v) => { setSubjectId(v ?? DEFAULT_SUBJECT); setTopicId(undefined) }} placeholder="Ders" />
          </Field>
          <Field label="Konu" className="lg:col-span-5">
            <TopicSelect subjectId={subjectId} value={topicId} onChange={setTopicId} />
          </Field>
          <Field label="Planlanan soru" className="lg:col-span-2" hint="0 = sınırsız">
            <NumberInput className="w-full" value={planned} onChange={setPlanned} />
          </Field>
          <Field label="Kaynak" className="lg:col-span-2">
            <Input value={source} placeholder="İsteğe bağlı" onChange={(e) => setSource(e.target.value)} />
          </Field>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <p className="text-sm text-muted">
            Her soruyu bitirince <Kbd>D</Kbd> <Kbd>Y</Kbd> <Kbd>B</Kbd> <Kbd>Ç</Kbd> (veya 1 / 2 / 3 / 4) tuşuna bas; süre otomatik kaydedilir. Boşluk: duraklat.
          </p>
          <Button
            variant="primary"
            icon={<Play size={15} />}
            onClick={() => {
              lsSet('yks-practice-last', { subjectId, topicId, source })
              useLive.getState().start({ subjectId, topicId, planned, source })
            }}
          >
            Başlat
          </Button>
        </div>
      </div>
    )
  }

  /* ---------- 3) özet ---------- */
  if (live.phase === 'summary') {
    return <Summary />
  }

  /* ---------- 2) ölçüm ---------- */
  const cur = curMs(live)
  const done = live.times.length
  const total = live.times.reduce((a, b) => a + b, 0) * 1000 + cur
  const running = live.phase === 'running'
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
        <span>
          {subjName}
          {topicName ? ` · ${topicName}` : ''}
        </span>
        <span className="tabular">
          Toplam <span className="text-text">{fmtClock(total / 1000)}</span>
          {live.planned > 0 && <span> · {done}/{live.planned} tamamlandı</span>}
          {live.planned === 0 && done > 0 && <span> · {done} tamamlandı</span>}
        </span>
      </div>

      <div className="flex flex-col items-center py-8">
        <div className="text-sm text-muted">
          {done + 1}. soru{live.planned > 0 ? ` / ${live.planned}` : ''}
        </div>
        <div
          className={`tabular mt-2 text-[clamp(64px,10vw,128px)] font-extralight leading-none tracking-tight text-text transition-opacity ${running ? '' : 'opacity-40'}`}
        >
          {fmtMs(cur)}
        </div>
        <div className="mt-3 h-4 text-xs text-subtle">{running ? '' : 'Duraklatıldı'}</div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {RESULTS.map(({ r, hint }) => (
            <button
              key={r}
              disabled={!running}
              onClick={() => useLive.getState().answer(r)}
              className="group flex h-14 w-36 items-center justify-center gap-2 rounded-xl border border-border text-sm transition hover:bg-surface-2 disabled:opacity-40"
            >
              <span className="h-2 w-2 rounded-full" style={{ background: RES_COLOR[r] }} />
              <span className="text-text">{RES_LABEL[r]}</span>
              <span className="tabular text-xs text-subtle">{hint}</span>
            </button>
          ))}
        </div>

        <div className="mt-6 flex items-center gap-1">
          {running ? (
            <Button variant="ghost" size="sm" icon={<Pause size={14} />} onClick={() => live.pause()}>
              Duraklat
            </Button>
          ) : (
            <Button variant="ghost" size="sm" icon={<Play size={14} />} onClick={() => live.resume()}>
              Devam
            </Button>
          )}
          <Button variant="ghost" size="sm" icon={<Undo2 size={14} />} disabled={!done} onClick={() => live.undo()}>
            Geri al
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={<Square size={14} />}
            disabled={!done}
            onClick={() => live.finish()}
          >
            Bitir
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="hover:text-danger"
            icon={<RotateCcw size={14} />}
            onClick={() => {
              live.reset()
              toast('Ölçüm iptal edildi', 'info')
            }}
          >
            İptal
          </Button>
        </div>
      </div>

      {done > 0 && (
        <div className="border-t border-border pt-4">
          <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            {(['D', 'Y', 'B', 'C'] as Res[]).map((r) => (
              <span key={r} className="tabular">
                <span style={{ color: RES_COLOR[r] }}>●</span> {live.results.filter((x) => x === r).length} {RES_LABEL[r].toLowerCase()}
              </span>
            ))}
            <span className="tabular">
              Ort. {fmtDur(live.times.reduce((a, b) => a + b, 0) / done)} / soru
            </span>
          </div>
          <QuestionChart times={live.times} results={live.results} height={110} />
        </div>
      )}
    </div>
  )
}

function Summary(): React.JSX.Element {
  const live = useLive()
  const addPracticeSet = useStore((s) => s.addPracticeSet)
  const topicName = live.topicId ? TOPIC_MAP[live.topicId]?.name : undefined
  const subjName = SUBJECT_MAP[live.subjectId]?.name
  const { times, results } = live
    const n = times.length
    const secs = times.reduce((a, b) => a + b, 0)
    const c = results.filter((r) => r === 'D').length
    const w = results.filter((r) => r === 'Y').length
    const b = results.filter((r) => r === 'B').length
    const h = results.filter((r) => r === 'C').length
    const slow = times
      .map((t, i) => ({ t, i, r: results[i] }))
      .sort((x, y) => y.t - x.t)
      .slice(0, 3)
    const src = live.source
    const [note, setNote] = useState('')

    if (n === 0) {
      return (
        <div className="py-10 text-center text-sm text-muted">
          Hiç soru kaydedilmedi.
          <div className="mt-3">
            <Button variant="outline" onClick={() => live.reset()}>
              Kapat
            </Button>
          </div>
        </div>
      )
    }
    return (
      <div className="space-y-5">
        <div className="text-sm text-muted">
          {subjName}
          {topicName ? ` · ${topicName}` : ''}
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-5">
          <Stat label="Soru" value={String(n)} />
          <Stat label="Toplam süre" value={fmtDur(secs)} />
          <Stat label="Ortalama" value={fmtDur(secs / n) + '/soru'} />
          <Stat label={h ? 'D · Y · B · Ç' : 'D · Y · B'} value={h ? `${c} · ${w} · ${b} · ${h}` : `${c} · ${w} · ${b}`} />
          <Stat label="Net" value={fmtNum(netOf(c, w), 2)} />
        </div>
        <QuestionChart times={times} results={results} avg={secs / n} height={200} />
        <div>
          <div className="mb-1 text-xs font-medium text-muted">En uzun süren 3 soru</div>
          <div className="divide-y divide-border">
            {slow.map((s) => (
              <div key={s.i} className="flex items-center justify-between py-1.5 text-sm">
                <span className="text-muted">{s.i + 1}. soru</span>
                <span className="tabular flex items-center gap-3">
                  <span className="text-text">{fmtDur(s.t)}</span>
                  <span style={{ color: RES_COLOR[s.r] }} className="w-24 text-right text-xs">
                    {RES_LABEL[s.r]}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
        <Field label="Not">
          <Input value={note} placeholder="İsteğe bağlı" onChange={(e) => setNote(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button
            variant="ghost"
            onClick={() => {
              live.reset()
              toast('Ölçüm silindi', 'info')
            }}
          >
            Vazgeç
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              addPracticeSet({
                date: live.date,
                subjectId: live.subjectId,
                topicId: live.topicId,
                count: n,
                seconds: secs,
                correct: c,
                wrong: w,
                blank: b,
                helped: h > 0 ? h : undefined,
                perQuestion: times,
                perResult: results,
                source: src?.trim() || undefined,
                note: note.trim() || undefined
              })
              live.reset()
              toast(`${n} soruluk set kaydedildi`)
            }}
          >
            Kaydet
          </Button>
        </div>
      </div>
    )
}

function Stat({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className="tabular mt-0.5 text-lg font-medium text-text">{value}</div>
    </div>
  )
}

function Kbd({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <kbd className="tabular rounded border border-border px-1.5 py-0.5 text-[11px] text-text">{children}</kbd>
}
