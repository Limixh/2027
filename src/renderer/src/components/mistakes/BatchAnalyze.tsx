// Toplu analiz: henüz AI ile analiz edilmemiş soruları sırayla analiz eder (İkinci Beyin kendiliğinden dolar).
import { useMemo, useRef, useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { Button, confirm, toast } from '@/components/ui'
import { analyzeNote, notesToAnalyze } from '@/lib/analyzeNote'
import { useStore } from '@/lib/store'

export function BatchAnalyze(): React.JSX.Element | null {
  const notes = useStore((s) => s.data.mistakeNotes)
  const todo = useMemo(() => notesToAnalyze(notes), [notes])
  const [prog, setProg] = useState<{ done: number; total: number; failed: number } | null>(null)
  const stop = useRef(false)

  if (!window.api || (!todo.length && !prog)) return null

  const run = async (): Promise<void> => {
    const ids = todo.map((n) => n.id)
    if (
      !(await confirm({
        title: `${ids.length} soru analiz edilsin mi?`,
        message: 'Sorular sırayla AI ile analiz edilir ve beceriler İkinci Beyin’e işlenir. Her analiz bir AI isteğidir (aboneliğinin kullanım limitinden düşer). İstediğin an durdurabilirsin.',
        confirmText: 'Başlat',
        danger: false
      }))
    )
      return
    stop.current = false
    let done = 0
    let failed = 0
    setProg({ done, total: ids.length, failed })
    for (const id of ids) {
      if (stop.current) break
      try {
        await analyzeNote(id)
      } catch {
        failed++
      }
      done++
      setProg({ done, total: ids.length, failed })
    }
    setProg(null)
    const ok = done - failed
    toast(failed ? `${ok} soru analiz edildi, ${failed} tanesi başarısız` : `${ok} soru analiz edildi · İkinci Beyin güncellendi`, failed ? 'error' : 'success')
  }

  if (prog)
    return (
      <div className="flex items-center gap-2 text-xs text-muted">
        <Loader2 size={13} className="animate-spin" />
        <span className="tabular">
          Analiz {Math.min(prog.done + 1, prog.total)}/{prog.total}
        </span>
        <Button variant="ghost" size="sm" onClick={() => (stop.current = true)}>
          Durdur
        </Button>
      </div>
    )
  return (
    <Button variant="outline" icon={<Sparkles size={14} />} onClick={() => void run()} title="Henüz analiz edilmemiş soruları sırayla AI ile analiz et">
      Toplu analiz
      <span className="tabular rounded bg-accent/15 px-1.5 text-[11px] font-semibold text-accent">{todo.length}</span>
    </Button>
  )
}
