import { useMemo, useState } from 'react'
import { Check, Trash2 } from 'lucide-react'
import type { ChatAttachment, MistakeKind, MistakeNote } from '../../../../shared/types'
import { Button, Field, Input, Modal, Select, Textarea, cn, confirm, toast } from '@/components/ui'
import { SUBJECTS, SUBJECT_MAP } from '@/data/curriculum'
import { MISTAKE_KIND_COLOR, MISTAKE_KIND_LABEL } from '@/lib/exam'
import { addDays, todayKey } from '@/lib/date'
import { useStore } from '@/lib/store'
import { ImagePicker } from './ImagePicker'

export const HELP_OPTIONS: { id: 'none' | 'hint' | 'sol'; label: string; title: string }[] = [
  { id: 'none', label: 'Kendim denedim', title: 'Çözüme bakmadım, çözemedim / yanlış yaptım' },
  { id: 'hint', label: 'Bir ipucuna baktım, gerisi benim', title: 'Çözümün sadece bir kısmına / bir trick’e baktım, gerisini kendim yaptım' },
  { id: 'sol', label: 'Çözüme bakarak yaptım', title: 'Çözümün tamamına bakarak yaptım' }
]

export const KINDS: MistakeKind[] = ['bilgi', 'dikkat', 'sure', 'yorum', 'bos', 'cozum']

export interface MistakeDraft {
  subjectId?: string
  topicId?: string
}

export function MistakeModal({
  note,
  draft,
  onClose
}: {
  /** düzenlenecek not; yoksa yeni not */
  note?: MistakeNote
  draft?: MistakeDraft
  onClose: () => void
}): React.JSX.Element {
  const add = useStore((s) => s.addMistakeNote)
  const update = useStore((s) => s.updateMistakeNote)
  const remove = useStore((s) => s.deleteMistakeNote)

  const defaultSubject =
    (note ? note.subjectId : undefined) ??
    draft?.subjectId ??
    SUBJECTS.find((s) => s.exam === 'TYT' && s.id === 'tyt-matematik')?.id ??
    SUBJECTS[0].id

  const [subjectId, setSubjectId] = useState(defaultSubject)
  const [topicId, setTopicId] = useState(note?.topicId ?? draft?.topicId ?? '')
  const [source, setSource] = useState(note?.source ?? '')
  const [text, setText] = useState(note?.text ?? '')
  const [lesson, setLesson] = useState(note?.lesson ?? '')
  const [kind, setKind] = useState<MistakeKind>(note?.kind ?? 'bilgi')
  const [date, setDate] = useState(note?.date ?? todayKey())
  const [resolved, setResolved] = useState(note?.resolved ?? false)
  const [correctAnswer, setCorrectAnswer] = useState(note?.correctAnswer ?? '')
  const [myAnswer, setMyAnswer] = useState(note?.myAnswer ?? '')
  const [help, setHelp] = useState<'none' | 'hint' | 'sol'>(note?.usedSolution || note?.kind === 'cozum' ? 'sol' : note?.usedHint ? 'hint' : 'none')
  const [hintSeen, setHintSeen] = useState(note?.hintSeen ?? '')
  const [tried, setTried] = useState(false)
  const [qImgs, setQImgs] = useState<ChatAttachment[]>(note?.questionImages ?? [])
  const [aImgs, setAImgs] = useState<ChatAttachment[]>(note?.attemptImages ?? [])
  const [pasteTo, setPasteTo] = useState<'q' | 'a'>('q')
  const hasImg = qImgs.length > 0 || aImgs.length > 0

  const save = (): void => {
    setTried(true)
    if (!text.trim() && !hasImg) return
    const payload = {
      subjectId,
      topicId: topicId || undefined,
      source: source.trim() || undefined,
      text: text.trim(),
      lesson: lesson.trim() || undefined,
      kind,
      date,
      resolved,
      correctAnswer: correctAnswer.trim() || undefined,
      myAnswer: myAnswer.trim() || undefined,
      usedSolution: help === 'sol' || undefined,
      usedHint: help === 'hint' || undefined,
      hintSeen: help === 'hint' ? hintSeen.trim() || undefined : undefined,
      questionImages: qImgs.length ? qImgs : undefined,
      attemptImages: aImgs.length ? aImgs : undefined
    }
    if (note) {
      update(note.id, { ...payload, inbox: false })
      toast('Not güncellendi')
    } else {
      // Görselli yeni not, çözülmediyse yarın tekrar döngüsüne girer
      add({ ...payload, nextReview: hasImg && !resolved ? addDays(todayKey(), 1) : undefined })
      toast('Hata defterine eklendi')
    }
    onClose()
  }

  const del = async (): Promise<void> => {
    if (!note) return
    if (await confirm({ title: 'Bu not silinsin mi?', message: 'Hata defterinden kalıcı olarak silinecek.' })) {
      remove(note.id)
      toast('Not silindi', 'info')
      onClose()
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={note ? 'Hata notunu düzenle' : 'Yeni hata notu'}
      subtitle="Soruyu görsel ya da metin olarak kaydet; AI analizi sonradan da yapılabilir."
      width={680}
      footer={
        <>
          {note && (
            <Button variant="danger" className="mr-auto" icon={<Trash2 size={14} />} onClick={() => void del()}>
              Sil
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Vazgeç
          </Button>
          <Button variant="primary" onClick={save}>
            {note ? 'Kaydet' : 'Ekle'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <ImagePicker
          label="Soru görseli"
          hint="Birden fazla görsel ekleyebilirsin."
          value={qImgs}
          onChange={setQImgs}
          pasteActive={pasteTo === 'q'}
          onActivate={() => setPasteTo('q')}
        />
        <ImagePicker
          label="Benim çözümüm (işlemli hali, isteğe bağlı)"
          hint="Çözemediğin sorudaki karalamanı silmeden ekle; AI hatanı satır satır bulur."
          value={aImgs}
          onChange={setAImgs}
          pasteActive={pasteTo === 'a'}
          onActivate={() => setPasteTo('a')}
        />

        <SubjectTopicFields
          subjectId={subjectId}
          topicId={topicId}
          onSubject={(v) => {
            setSubjectId(v)
            setTopicId('')
          }}
          onTopic={setTopicId}
        />

        <div className="grid grid-cols-[1fr_170px] gap-3">
          <Field label="Kaynak (kitap / deneme adı)">
            <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="ör. 3D TYT Deneme 4, Soru 23" />
          </Field>
          <Field label="Tarih">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>

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
                    'inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-all',
                    !active && 'border-border bg-surface-2 text-muted hover:text-text'
                  )}
                  style={active ? { borderColor: c, background: c + '1f', color: c } : undefined}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: c }} />
                  {MISTAKE_KIND_LABEL[k]}
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-2">
          <Field label="Doğru cevap" hint="ör. C ya da 12">
            <AnswerInput value={correctAnswer} onChange={setCorrectAnswer} />
          </Field>
          <Field label="Benim cevabım" hint="Boş bıraktıysan boş geç">
            <AnswerInput value={myAnswer} onChange={setMyAnswer} />
          </Field>
          <div className="md:col-span-2">
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
              <Textarea
                rows={2}
                className="mt-2"
                value={hintSeen}
                onChange={(e) => setHintSeen(e.target.value)}
                placeholder="Neyi gördün? ör. ortak paranteze alındığını gördüm, sonrasını kendim yaptım"
              />
            )}
          </div>
        </div>

        <Field label={hasImg ? 'Not (isteğe bağlı)' : 'Soru / hata açıklaması'} hint={tried && !text.trim() && !hasImg ? undefined : 'Soruyu veya neyi yanlış yaptığını kısaca yaz.'}>
          <Textarea
            autoFocus={!note && !hasImg}
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="ör. Türev uygulamasında kritik noktayı bulurken ikinci türev işaretini ters yorumladım…"
            className={cn(tried && !text.trim() && !hasImg && 'border-danger focus:border-danger focus:ring-danger/25')}
          />
          {tried && !text.trim() && !hasImg && <span className="mt-1 block text-[11px] text-danger">Açıklama yaz ya da bir görsel ekle.</span>}
        </Field>

        <Field label="Doğrusu / çıkardığım ders">
          <Textarea
            rows={3}
            value={lesson}
            onChange={(e) => setLesson(e.target.value)}
            placeholder="Doğru çözüm, formül ya da bir daha yapmamak için kuralın…"
          />
        </Field>

        <button
          type="button"
          onClick={() => setResolved((r) => !r)}
          className={cn(
            'flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors',
            resolved ? 'border-success/40 bg-success/10' : 'border-border bg-surface-2 hover:bg-surface-3'
          )}
        >
          <span
            className={cn(
              'grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors',
              resolved ? 'border-success bg-success text-white' : 'border-subtle/60'
            )}
          >
            {resolved && <Check size={13} strokeWidth={3} />}
          </span>
          <span>
            <span className="block text-sm font-medium text-text">Çözüldü / artık biliyorum</span>
            <span className="block text-[11px] text-muted">İşaretlenen notlar tekrar modunda sorulmaz.</span>
          </span>
        </button>
      </div>
    </Modal>
  )
}

/** Ders + konu seçimi (alanına ait AYT dersleri önce) */
export function SubjectTopicFields({
  subjectId,
  topicId,
  onSubject,
  onTopic
}: {
  subjectId: string
  topicId: string
  onSubject: (v: string) => void
  onTopic: (v: string) => void
}): React.JSX.Element {
  const lastField = useStore((s) => s.data.settings.field)
  const subject = SUBJECT_MAP[subjectId]
  const tyt = SUBJECTS.filter((s) => s.exam === 'TYT')
  const aytSorted = useMemo(
    () =>
      SUBJECTS.filter((s) => s.exam === 'AYT').sort((a, b) => Number(b.fields.includes(lastField)) - Number(a.fields.includes(lastField))),
    [lastField]
  )

  const groups = useMemo(() => {
    const m = new Map<string, NonNullable<typeof subject>['topics']>()
    for (const t of subject?.topics ?? []) {
      const k = t.group ?? ''
      m.set(k, [...(m.get(k) ?? []), t])
    }
    return [...m.entries()]
  }, [subject])

  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Ders">
        <Select value={subjectId} onChange={(e) => onSubject(e.target.value)}>
          {subjectId === '' && <option value="">— Ders seç —</option>}
          <optgroup label="TYT">
            {tyt.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="AYT">
            {aytSorted.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </optgroup>
        </Select>
      </Field>
      <Field label="Konu (isteğe bağlı)">
        <Select value={topicId} onChange={(e) => onTopic(e.target.value)}>
          <option value="">— Konu seçme —</option>
          {groups.map(([g, items]) =>
            g ? (
              <optgroup key={g} label={g}>
                {items.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </optgroup>
            ) : (
              items.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))
            )
          )}
        </Select>
      </Field>
    </div>
  )
}

/** Cevap kutusu: A-E kısayolları + serbest metin (sayısal cevaplar için) */
export function AnswerInput({ value, onChange }: { value: string; onChange: (v: string) => void }): React.JSX.Element {
  return (
    <div className="flex items-center gap-1">
      {['A', 'B', 'C', 'D', 'E'].map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(value === o ? '' : o)}
          className={cn(
            'h-9 w-8 shrink-0 rounded-lg border text-xs font-semibold transition-colors',
            value === o ? 'border-accent bg-accent text-on-accent' : 'border-border bg-surface-2 text-muted hover:text-text'
          )}
        >
          {o}
        </button>
      ))}
      <Input
        value={['A', 'B', 'C', 'D', 'E'].includes(value) ? '' : value}
        onChange={(e) => onChange(e.target.value.slice(0, 40))}
        placeholder="diğer (ör. 12)"
        className="w-28 min-w-0 flex-1"
      />
    </div>
  )
}
