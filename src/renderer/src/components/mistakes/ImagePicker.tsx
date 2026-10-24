import { useEffect, useRef, useState } from 'react'
import { ImagePlus, X } from 'lucide-react'
import type { ChatAttachment } from '../../../../shared/types'
import { cn, toast } from '@/components/ui'
import { saveFile } from '@/lib/files'
import { NoteImage } from './NoteImage'

/** Sürükle-bırak / dosya seç / Ctrl+V ile çoklu görsel ekleme */
export function ImagePicker({
  label,
  hint,
  value,
  onChange,
  pasteActive,
  onActivate
}: {
  label: string
  hint?: string
  value: ChatAttachment[]
  onChange: (v: ChatAttachment[]) => void
  /** Ctrl+V bu alana mı gidecek */
  pasteActive: boolean
  onActivate: () => void
}): React.JSX.Element {
  const desktop = !!window.api
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState(0)
  const valueRef = useRef(value)
  valueRef.current = value

  const addFiles = async (files: File[]): Promise<void> => {
    const imgs = files.filter((f) => f.type.startsWith('image/'))
    if (!imgs.length) return
    if (!desktop) {
      toast('Görsel yükleme yalnızca masaüstü uygulamasında çalışır', 'error')
      return
    }
    setBusy((b) => b + imgs.length)
    const added: ChatAttachment[] = []
    for (const f of imgs) {
      try {
        added.push(await saveFile(f))
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Görsel kaydedilemedi', 'error')
      }
      setBusy((b) => b - 1)
    }
    if (added.length) onChange([...valueRef.current, ...added])
  }
  const addRef = useRef(addFiles)
  addRef.current = addFiles

  useEffect(() => {
    if (!pasteActive) return
    const onPaste = (e: ClipboardEvent): void => {
      const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'))
      if (!files.length) return
      e.preventDefault()
      void addRef.current(files)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [pasteActive])

  return (
    <div onMouseEnter={onActivate} onFocus={onActivate}>
      <span className="label">{label}</span>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          void addFiles([...e.dataTransfer.files])
        }}
        className={cn(
          'rounded-xl border border-dashed p-3 transition-colors',
          over ? 'border-accent bg-accent/5' : pasteActive ? 'border-subtle/60' : 'border-border'
        )}
      >
        {value.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {value.map((a, i) => (
              <div key={a.rel + i} className="group relative h-20 w-20 overflow-hidden rounded-lg border border-border bg-surface-2">
                <NoteImage att={a} className="h-full w-full" imgClassName="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => onChange(value.filter((_, j) => j !== i))}
                  className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                  aria-label="Görseli kaldır"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => (desktop ? input.current?.click() : toast('Görsel yükleme yalnızca masaüstü uygulamasında çalışır', 'error'))}
          className="flex w-full items-center justify-center gap-2 py-2 text-xs text-muted hover:text-text"
        >
          <ImagePlus size={15} />
          {busy > 0 ? 'Yükleniyor…' : 'Görseli sürükle, yapıştır (Ctrl+V) ya da dosya seç'}
        </button>
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            void addFiles([...(e.target.files ?? [])])
            e.target.value = ''
          }}
        />
      </div>
      {hint && <p className="mt-1 text-[11px] text-subtle">{hint}</p>}
      {!desktop && <p className="mt-1 text-[11px] text-subtle">Görsel ekleme yalnızca masaüstü uygulamasında çalışır.</p>}
    </div>
  )
}
