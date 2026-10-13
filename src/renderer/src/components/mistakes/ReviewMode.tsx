import { useEffect, useMemo, useState } from 'react'
import { BookMarked, Eye, PartyPopper, ThumbsDown, ThumbsUp } from 'lucide-react'
import { Badge, Button, Modal, ProgressBar } from '@/components/ui'
import { SUBJECT_MAP, TOPIC_MAP } from '@/data/curriculum'
import { MISTAKE_KIND_COLOR, MISTAKE_KIND_LABEL } from '@/lib/exam'
import { useStore } from '@/lib/store'

function shuffle<T>(a: T[]): T[] {
  const r = [...a]
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[r[i], r[j]] = [r[j], r[i]]
  }
  return r
}

/** Açık hata notlarını tek tek soran flashcard modu */
export function ReviewMode({ ids, onClose }: { ids: string[]; onClose: () => void }): React.JSX.Element {
  const notes = useStore((s) => s.data.mistakeNotes)
  const update = useStore((s) => s.updateMistakeNote)
  const queue = useMemo(() => shuffle(ids), [ids])
  const [idx, setIdx] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [known, setKnown] = useState(0)
  const [hard, setHard] = useState(0)

  const note = notes.find((n) => n.id === queue[idx])
  const finished = idx >= queue.length

  const answer = (knows: boolean): void => {
    if (!note) return
    if (knows) {
      update(note.id, { resolved: true })
      setKnown((k) => k + 1)
    } else setHard((h) => h + 1)
    setRevealed(false)
    setIdx((i) => i + 1)
  }

  useEffect(() => {
    if (finished) return
    const onKey = (e: KeyboardEvent): void => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (!revealed && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault()
        setRevealed(true)
      } else if (revealed && e.key === '1') answer(false)
      else if (revealed && e.key === '2') answer(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed, finished, idx, note])

  const subject = note ? SUBJECT_MAP[note.subjectId] : undefined
  const topic = note?.topicId ? TOPIC_MAP[note.topicId] : undefined

  return (
    <Modal
      open
      onClose={onClose}
      title="Tekrar modu"
      subtitle={finished ? 'Tur tamamlandı' : `${idx + 1} / ${queue.length} · açık hata notların sırayla geliyor`}
      width={640}
      footer={
        finished ? (
          <Button variant="primary" onClick={onClose}>
            Kapat
          </Button>
        ) : revealed ? (
          <>
            <Button variant="outline" icon={<ThumbsDown size={14} />} onClick={() => answer(false)}>
              Hâlâ zorlanıyorum <kbd className="ml-1 rounded bg-surface-3 px-1 text-[10px] text-muted">1</kbd>
            </Button>
            <Button variant="primary" icon={<ThumbsUp size={14} />} onClick={() => answer(true)}>
              Artık biliyorum <kbd className="ml-1 rounded bg-white/20 px-1 text-[10px]">2</kbd>
            </Button>
          </>
        ) : (
          <Button variant="primary" icon={<Eye size={14} />} onClick={() => setRevealed(true)}>
            Doğrusunu göster <kbd className="ml-1 rounded bg-white/20 px-1 text-[10px]">Boşluk</kbd>
          </Button>
        )
      }
    >
      <ProgressBar value={queue.length ? idx / queue.length : 0} className="mb-4" height={4} />

      {finished ? (
        <div className="flex flex-col items-center py-8 text-center">
          <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-success/10 text-success">
            <PartyPopper size={26} />
          </div>
          <div className="text-base font-semibold">Harika, tur bitti!</div>
          <p className="mt-1 max-w-xs text-sm text-muted">
            <span className="font-semibold text-success">{known}</span> not çözüldü olarak işaretlendi,{' '}
            <span className="font-semibold text-warning">{hard}</span> not tekrar için açık kaldı.
          </p>
        </div>
      ) : note ? (
        <div key={note.id} className="animate-fade-in">
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <Badge color={subject?.color}>{subject?.name}</Badge>
            <Badge color={MISTAKE_KIND_COLOR[note.kind]}>{MISTAKE_KIND_LABEL[note.kind]}</Badge>
            {topic && <span className="truncate text-xs text-muted">{topic.name}</span>}
            {note.source && <span className="truncate text-xs text-subtle">· {note.source}</span>}
          </div>
          <div className="rounded-2xl border border-border bg-surface-2 p-5">
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-text">{note.text}</p>
          </div>
          {revealed ? (
            <div className="mt-3 animate-fade-in rounded-2xl border border-success/30 bg-success/5 p-5">
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-success">
                <BookMarked size={12} /> Doğrusu / çıkardığım ders
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">
                {note.lesson || 'Bu not için ders yazılmamış. Düzenleyip eklemeyi unutma.'}
              </p>
            </div>
          ) : (
            <p className="mt-3 text-center text-xs text-subtle">Önce doğrusunu aklından getir, sonra cevabı göster.</p>
          )}
        </div>
      ) : null}
    </Modal>
  )
}
