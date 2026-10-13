import { useMemo, useState } from 'react'
import type { StudySession } from '../../../../shared/types'
import { Button, cn, Field, Input, Modal, NumberInput, Segmented, Textarea, toast } from '@/components/ui'
import { formatMinutes, todayKey } from '@/lib/date'
import { useStore } from '@/lib/store'
import { KIND_LABEL, type SessionKind } from './meta'
import { SubjectSelect, TopicSelect } from './SubjectSelect'

export interface SessionDefaults {
  date?: string
  minutes?: number
  subjectId?: string
  topicId?: string
  kind?: SessionKind
}

interface Props {
  open: boolean
  onClose: () => void
  /** Düzenlenecek oturum; yoksa yeni kayıt */
  session?: StudySession
  defaults?: SessionDefaults
  onSaved?: () => void
}

const QUICK = [25, 50, 90, 120]

const toStr = (n?: number): string => (n === undefined ? '' : String(n))
const toNum = (s: string): number | undefined => {
  if (s.trim() === '') return undefined
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined
}

export function SessionForm(props: Props): React.JSX.Element | null {
  if (!props.open) return null
  return <FormInner {...props} />
}

function FormInner({ onClose, session, defaults, onSaved }: Props): React.JSX.Element {
  const addSession = useStore((s) => s.addSession)
  const updateSession = useStore((s) => s.updateSession)
  const dailyGoal = useStore((s) => s.data.settings.dailyGoalMinutes)

  const initMin = session?.minutes ?? defaults?.minutes ?? 0
  const [date, setDate] = useState(session?.date ?? defaults?.date ?? todayKey())
  const [hours, setHours] = useState(Math.floor(initMin / 60))
  const [mins, setMins] = useState(initMin % 60)
  const [kind, setKind] = useState<SessionKind>(session?.kind ?? defaults?.kind ?? 'konu')
  const [subjectId, setSubjectId] = useState<string | undefined>(session?.subjectId ?? defaults?.subjectId)
  const [topicId, setTopicId] = useState<string | undefined>(session?.topicId ?? defaults?.topicId)
  const [solved, setSolved] = useState(toStr(session?.solved))
  const [correct, setCorrect] = useState(toStr(session?.correct))
  const [wrong, setWrong] = useState(toStr(session?.wrong))
  const [note, setNote] = useState(session?.note ?? '')
  const [tried, setTried] = useState(false)

  const total = hours * 60 + mins
  const s = toNum(solved)
  const c = toNum(correct)
  const w = toNum(wrong)
  const answered = (c ?? 0) + (w ?? 0)
  const effectiveSolved = s ?? (answered > 0 ? answered : undefined)

  const errors = useMemo(() => {
    const e: string[] = []
    if (!date) e.push('Tarih seçin.')
    if (total <= 0) e.push('Süre en az 1 dakika olmalı.')
    if (s !== undefined && answered > s) e.push('Doğru + yanlış sayısı çözülen soru sayısını aşamaz.')
    return e
  }, [date, total, s, answered])

  const blank = s !== undefined && answered <= s && answered > 0 ? s - answered : undefined

  const save = (): void => {
    setTried(true)
    if (errors.length) return
    const payload = {
      date,
      minutes: total,
      kind,
      subjectId,
      topicId: subjectId ? topicId : undefined,
      solved: effectiveSolved,
      correct: c,
      wrong: w,
      note: note.trim() || undefined
    }
    if (session) {
      updateSession(session.id, payload)
      toast('Oturum güncellendi')
    } else {
      addSession(payload)
      toast(`${formatMinutes(total)} çalışma eklendi`)
    }
    onSaved?.()
    onClose()
  }

  const setTotal = (m: number): void => {
    setHours(Math.floor(m / 60))
    setMins(m % 60)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={session ? 'Çalışmayı düzenle' : 'Çalışma ekle'}
      subtitle="Ne kadar ve neyi çalıştığını kaydet — ısı haritan buna göre renklenir."
      width={620}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Vazgeç
          </Button>
          <Button variant="primary" onClick={save}>
            {session ? 'Kaydet' : 'Çalışmayı ekle'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-[1fr_1.4fr] gap-3">
          <Field label="Tarih">
            <Input type="date" value={date} max={todayKey()} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <div>
            <span className="label">Süre</span>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <NumberInput value={hours} onChange={setHours} max={16} className="pr-9" aria-label="Saat" />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-subtle">sa</span>
              </div>
              <div className="relative flex-1">
                <NumberInput value={mins} onChange={setMins} max={59} className="pr-9" aria-label="Dakika" />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-subtle">dk</span>
              </div>
            </div>
          </div>
        </div>

        <div className="-mt-1 flex flex-wrap items-center gap-1.5">
          {QUICK.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setTotal(total + q)}
              className={cn(
                'h-7 rounded-md border border-border bg-surface-2 px-2.5 text-xs font-medium text-muted transition hover:border-accent/50 hover:text-text'
              )}
            >
              +{q} dk
            </button>
          ))}
          {total > 0 && (
            <button type="button" onClick={() => setTotal(0)} className="h-7 rounded-md px-2 text-xs text-subtle hover:text-text">
              Sıfırla
            </button>
          )}
          <span className="ml-auto text-xs text-subtle">
            {total > 0 ? `Toplam ${total} dk` : ''}
            {total > 0 && dailyGoal > 0 && ` · günlük hedefin %${Math.round((total / dailyGoal) * 100)}'i`}
          </span>
        </div>

        <div>
          <span className="label">Çalışma türü</span>
          <Segmented
            size="sm"
            value={kind}
            onChange={setKind}
            options={(Object.keys(KIND_LABEL) as SessionKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Ders">
            <SubjectSelect
              value={subjectId}
              onChange={(v) => {
                setSubjectId(v)
                setTopicId(undefined)
              }}
            />
          </Field>
          <Field label="Konu">
            <TopicSelect subjectId={subjectId} value={topicId} onChange={setTopicId} />
          </Field>
        </div>

        <div>
          <span className="label">Soru çözümü (isteğe bağlı)</span>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Input type="number" min={0} placeholder="Çözülen" value={solved} onChange={(e) => setSolved(e.target.value)} className="tabular text-center" />
            </div>
            <div>
              <Input type="number" min={0} placeholder="Doğru" value={correct} onChange={(e) => setCorrect(e.target.value)} className="tabular text-center" />
            </div>
            <div>
              <Input type="number" min={0} placeholder="Yanlış" value={wrong} onChange={(e) => setWrong(e.target.value)} className="tabular text-center" />
            </div>
          </div>
          {blank !== undefined && blank > 0 && (
            <p className="mt-1 text-[11px] text-subtle">{blank} soru boş bırakıldı.</p>
          )}
        </div>

        <Field label="Not">
          <Textarea
            rows={2}
            value={note}
            placeholder="Örn. Türev uygulamaları, 3. ünite sonu testleri…"
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>

        {tried && errors.length > 0 && (
          <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            {errors.map((e) => (
              <div key={e}>{e}</div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}
