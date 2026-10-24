import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Image as ImageIcon, X } from 'lucide-react'
import type { ChatAttachment } from '../../../../shared/types'
import { cn } from '@/components/ui'
import { fileUrl } from '@/lib/files'

/** Görsel; adres yoksa (web modu) ya da yüklenemezse sade bir yer tutucu gösterir */
export function NoteImage({
  att,
  className,
  imgClassName,
  zoom = false
}: {
  att: ChatAttachment
  className?: string
  imgClassName?: string
  /** tıklanınca tam ekran büyüt */
  zoom?: boolean
}): React.JSX.Element {
  const url = fileUrl(att)
  const [failed, setFailed] = useState(false)
  const [big, setBig] = useState(false)
  const ok = !!url && !failed

  const body = ok ? (
    <img src={url} alt={att.name} loading="lazy" onError={() => setFailed(true)} className={cn('block', imgClassName)} />
  ) : (
    <div className="flex h-full min-h-[96px] w-full flex-col items-center justify-center gap-1.5 text-subtle">
      <ImageIcon size={20} strokeWidth={1.5} />
      <span className="max-w-full truncate px-2 text-[11px]">{att.name}</span>
    </div>
  )

  return (
    <>
      {zoom && ok ? (
        <button
          type="button"
          onClick={() => setBig(true)}
          className={cn('block cursor-zoom-in overflow-hidden', className)}
          aria-label="Büyüt"
        >
          {body}
        </button>
      ) : (
        <div className={cn('overflow-hidden', className)}>{body}</div>
      )}
      {big && <Lightbox url={url} name={att.name} onClose={() => setBig(false)} />}
    </>
  )
}

function Lightbox({ url, name, onClose }: { url: string; name: string; onClose: () => void }): React.JSX.Element {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])
  return createPortal(
    <div className="fixed inset-0 z-[70] flex animate-fade-in items-center justify-center bg-black/80 p-6" onClick={onClose}>
      <button
        type="button"
        onClick={onClose}
        className="absolute right-5 top-5 grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
        aria-label="Kapat"
      >
        <X size={18} />
      </button>
      <img src={url} alt={name} className="max-h-full max-w-full cursor-zoom-out rounded-lg object-contain" />
    </div>,
    document.body
  )
}
