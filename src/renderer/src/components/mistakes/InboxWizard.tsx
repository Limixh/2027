// Toplu giriş: telefondan gelen (henüz incelenmemiş) soruları sırayla açar; her biri için
// ders, konu, cevaplar ve hata türü girilip kaydedilince sıradakine geçilir.
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, SkipForward, Trash2 } from 'lucide-react'
import type { ChatAttachment, MistakeKind, MistakeNote } from '../../../../shared/types'
import { Button, Field, Input, Modal, Textarea, cn, confirm, toast } from '@/components/ui'
import { MISTAKE_KIND_COLOR, MISTAKE_KIND_LABEL } from '@/lib/exam'
import { useStore } from '@/lib/store'
import { AnswerInput, HELP_OPTIONS, KINDS, SubjectTopicFields } from './MistakeModal'
import { ImagePicker } from './ImagePicker'
import { NoteImage } from './NoteImage'

/** Bir sorudan diğerine taşınan alanlar (aynı denemeden gelen sorular genelde aynı ders/kaynak) */
interface Sticky {
  subjectId: string
  source: string
}

export function InboxWizard({ onClose }: { onClose: () => void }): React.JSX.Element | null {
  // Açılıştaki gelen kutusu sırası sabit kalır (kaydedilen notlar inbox'tan çıksa da sıra bozulmaz)
  const [ids] = useState(() =>
    useStore
      .getState()
      .data.mistakeNotes.filter((n) => n.inbox)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((n) => n.id)
  )
  const [index, setIndex] = useState(0)
  const saved = useRef(0)
  const sticky = useRef<Sticky>({ subjectId: '', source: '' })
  const note = useStore((s) => s.data.mistakeNotes.find((m) => m.id === ids[index]))
  const finished = index >= ids.length

  useEffect(() => {
    if (finished) {
      if (saved.current) toast(`${saved.current} soru kaydedildi`)
      onClose()
    } else if (!note) setIndex((i) => i + 1) // bu arada silinmiş
  }, [finished, note, onClose])

  if (finished || !note) return null
  return (
    <InboxForm
      key={note.id}
      note={note}
      position={index + 1}
      total={ids.length}
      sticky={sticky.current}
      onClose={onClose}
      onNext={(didSave) => {
        if (didSave) saved.current++
        setIndex((i) => i + 1)
      }}
      onSticky={(s) => (sticky.current = s)}
    />
  )
}

function InboxForm({
  note,
  position,
  total,
  sticky,
  onClose,
  onNext,
  onSticky
}: {
  note: MistakeNote
  position: number
  total: number
  sticky: Sticky
  onClose: () => void
  onNext: (saved: boolean) => void
  onSticky: (s: Sticky) => void
}): React.JSX.Element {
  const update = useStore((s) => s.updateMistakeNote)
  const remove = useStore((s) => s.deleteMistakeNote)

  const [subjectId, setSubjectId] = useState(note.subjectId || sticky.subjectId)
  const [topicId, setTopicId] = useState(note.topicId ?? '')
  const [source, setSource] = useState(note.source ?? sticky.source)
  const [correctAnswer, setCorrectAnswer] = useState(note.correctAnswer ?? '')
  const [myAnswer, setMyAnswer] = useState(note.myAnswer ?? '')
  const [help, setHelp] = useState<'none' | 'hint' | 'sol'>(note.usedSolution ? 'sol' : note.usedHint ? 'hint' : 'none')
  const [hintSeen, setHintSeen] = useState(note.hintSeen ?? '')
  const [kind, setKind] = useState<MistakeKind>(note.kind)
  const [text, setText] = useState(note.text)
  const [aImgs, setAImgs] = useState<ChatAttachment[]>(note.attemptImages ?? [])
  const [tried, setTried] = useState(false)

  const save = (): void => {
    setTried(true)
    if (!subjectId) return
    update(note.id, {
      subjectId,
      topicId: topicId || undefined,
      source: source.trim() || undefined,
      correctAnswer: correctAnswer.trim() || undefined,
      myAnswer: myAnswer.trim() || undefined,
      usedSolution: help === 'sol' || undefined,
      usedHint: help === 'hint' || undefined,
      hintSeen: help === 'hint' ? hintSeen.trim() || undefined : undefined,
      kind,
      text: text.trim(),
      attemptImages: aImgs.length ? aImgs : undefined,
      inbox: false
    })
    onSticky({ subjectId, source: source.trim() })
    onNext(true)
  }
  const saveRef = useRef(save)
  saveRef.current = save

  // Ctrl+Enter: kaydet ve sıradakine geç
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        saveRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const del = async (): Promise<void> => {
    if (await confirm({ title: 'Bu soru silinsin mi?', message: 'Hata defterinden kalıcı olarak silinecek.' })) {
      remove(note.id)
      onNext(false)
    }
  }

  const last = position === total

  return (
    <Modal
      open
      onClose={onClose}
      title="Toplu giriş"
      subtitle={`Telefondan gelen sorular · ${position} / ${total}`}
      width={1100}
      footer={
        <>
          <Button variant="ghost" className="mr-auto text-danger hover:bg-danger/10" icon={<Trash2 size={14} />} onClick={() => void del()}>
            Sil
          </Button>
          <Button variant="ghost" icon={<SkipForward size={14} />} onClick={() => onNext(false)} title="Bu soruyu şimdilik geç; gelen kutusunda kalır">
            Atla
          </Button>
          <Button variant="primary" onClick={save} title="Ctrl+Enter">
            {last ? 'Kaydet ve bitir' : 'Kaydet ve sonraki'}
            {!last && <ArrowRight size={14} />}
          </Button>
        </>
      }
    >
      <div className="mb-4 h-1 overflow-hidden rounded-full bg-surface-3">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${((position - 1) / total) * 100}%` }} />
      </div>
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-3">
          {(note.questionImages ?? []).map((a, i) => (
            <NoteImage key={a.rel + i} att={a} zoom className="rounded-lg border border-border bg-surface-2" imgClassName="mx-auto max-h-[62vh] w-auto max-w-full" />
          ))}
          {!note.questionImages?.length && <p className="whitespace-pre-wrap text-sm">{note.text}</p>}
        </div>

        <div className="space-y-4">
          <SubjectTopicFields
            subjectId={subjectId}
            topicId={topicId}
            onSubject={(v) => {
              setSubjectId(v)
              setTopicId('')
            }}
            onTopic={setTopicId}
          />
          {tried && !subjectId && <p className="-mt-2 text-[11px] text-danger">Kaydetmek için ders seç.</p>}

          <Field label="Kaynak">
            <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="ör. 3D TYT Deneme 4, Soru 23" />
          </Field>

          <Field label="Doğru cevap">
            <AnswerInput value={correctAnswer} onChange={setCorrectAnswer} />
          </Field>
          <Field label="Benim cevabım">
            <AnswerInput value={myAnswer} onChange={setMyAnswer} />
          </Field>

          <div className="flex flex-wrap gap-1.5">
            {HELP_OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  setHelp(o.id)
                  if (o.id === 'sol') setKind('cozum')
                  else if (kind === 'cozum') setKind('bilgi')
                }}
                className={cn(
                  'h-8 rounded-lg border px-3 text-xs font-medium transition-colors',
                  help === o.id ? 'border-[#4f9a95] bg-[#4f9a95]/15 text-[#4f9a95]' : 'border-border bg-surface-2 text-muted hover:text-text'
                )}
                title={o.title}
              >
                {o.label}
              </button>
            ))}
          </div>
          {help === 'hint' && (
            <Textarea rows={2} value={hintSeen} onChange={(e) => setHintSeen(e.target.value)} placeholder="Neyi gördün? ör. ortak paranteze alındığını gördüm" />
          )}

          <div>
            <span className="label">Hata türü</span>
            <div className="flex flex-wrap gap-1.5">
              {KINDS.map((k) => {
                const active = kind === k
                const c = MISTAKE_KIND_COLOR[k]
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    className={cn(
                      'inline-flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-medium transition-all',
                      !active && 'border-border bg-surface-2 text-muted hover:text-text'
                    )}
                    style={active ? { borderColor: c, background: c + '1f', color: c } : undefined}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
                    {MISTAKE_KIND_LABEL[k]}
                  </button>
                )
              })}
            </div>
          </div>

          <Field label="Not (isteğe bağlı)">
            <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="ör. Süre yetmedi / şıklar arasında kaldım" />
          </Field>

          <ImagePicker
            label="Benim çözümüm (isteğe bağlı)"
            value={aImgs}
            onChange={setAImgs}
            pasteActive
            onActivate={() => undefined}
          />
          <p className="text-[11px] text-subtle">Ctrl+Enter ile kaydedip sıradakine geçebilirsin. AI analizini sonra soru kartından başlatırsın.</p>
        </div>
      </div>
    </Modal>
  )
}
