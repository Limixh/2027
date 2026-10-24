// Soru sayfasındaki "Tahtada çözüm" bölümü: oluştur / yeniden oluştur ve oynatıcı.
import { useState } from 'react'
import { Loader2, PenLine, RefreshCw } from 'lucide-react'
import type { BoardSolution, MistakeNote } from '../../../../shared/types'
import { Button, Segmented, confirm } from '@/components/ui'
import { AiError } from '@/lib/aiRunner'
import { generateBoard } from '@/lib/board'
import { formatDate } from '@/lib/date'
import { useStore } from '@/lib/store'
import { Board } from './Board'

export function BoardPanel({ note }: { note: MistakeNote }): React.JSX.Element {
  const update = useStore((s) => s.updateMistakeNote)
  const [mode, setMode] = useState<BoardSolution['mode']>(note.board?.mode ?? (note.aiAnalysis ? 'different' : 'same'))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const hasImg = (note.questionImages?.length ?? 0) > 0

  const run = async (): Promise<void> => {
    if (busy) return
    if (note.board && !(await confirm({ title: 'Tahta yeniden çizilsin mi?', message: 'Mevcut tahta çözümü yenisiyle değişir.', confirmText: 'Yeniden çiz', danger: false })))
      return
    setBusy(true)
    setError('')
    try {
      const board = await generateBoard(useStore.getState().data.mistakeNotes.find((m) => m.id === note.id) ?? note, mode)
      update(note.id, { board })
    } catch (e) {
      setError(e instanceof AiError || e instanceof Error ? e.message : 'Tahta hazırlanamadı')
    } finally {
      setBusy(false)
    }
  }

  const modeSwitch = (
    <Segmented
      size="sm"
      value={mode}
      onChange={setMode}
      options={[
        { value: 'same', label: note.aiAnalysis ? 'Analizdeki yolla' : 'Standart yolla' },
        { value: 'different', label: 'Farklı bir yolla' }
      ]}
    />
  )

  if (!note.board)
    return (
      <div>
        <p className="mb-3 max-w-xl text-xs leading-relaxed text-muted">
          AI soruyu bir öğretmen tahtada çözüyormuş gibi adım adım yazar ve her adımda ne yaptığını anlatır. İstersen sesli dinlersin.
          {!hasImg && !note.text.trim() && ' (Önce soruya görsel ya da metin ekle.)'}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {modeSwitch}
          <Button variant="outline" size="sm" disabled={busy || (!hasImg && !note.text.trim())} icon={busy ? <Loader2 size={13} className="animate-spin" /> : <PenLine size={13} />} onClick={() => void run()}>
            {busy ? 'Tahta hazırlanıyor…' : 'Tahtada çöz'}
          </Button>
        </div>
        {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      </div>
    )

  return (
    <div>
      <Board key={note.board.createdAt} solution={note.board} />
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3 text-[11px] text-subtle">
        <span>
          {note.board.mode === 'different' ? 'Farklı yolla' : 'Analizdeki yolla'} · {formatDate(note.board.createdAt.slice(0, 10))}
          {note.board.model && ` · ${note.board.model}`}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {modeSwitch}
          <Button variant="ghost" size="sm" disabled={busy} icon={busy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} onClick={() => void run()}>
            {busy ? 'Çiziliyor…' : 'Yeniden çiz'}
          </Button>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  )
}
