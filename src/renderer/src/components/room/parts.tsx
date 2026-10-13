// Çalışma Odası için cam görünümlü küçük arayüz parçaları.
import { X } from 'lucide-react'
import { forwardRef, useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/components/ui'

/* Açık katman sayısı: Esc ile sayfadan çıkmayı engellemek için */
let overlays = 0
export const isOverlayOpen = (): boolean => overlays > 0
export function useOverlayFlag(open: boolean): void {
  useEffect(() => {
    if (!open) return
    overlays++
    return () => {
      overlays--
    }
  }, [open])
}

const fieldCls =
  'h-10 w-full rounded-xl border border-text/15 bg-text/[0.06] px-3 text-sm text-text outline-none transition placeholder:text-muted/80 focus:border-accent focus:ring-2 focus:ring-accent/30'

export const GInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function GInput({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(fieldCls, className)} {...rest} />
})

export const GSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function GSelect(
  { className, children, ...rest },
  ref
) {
  return (
    <select ref={ref} className={cn(fieldCls, 'cursor-pointer pr-8 [&>*]:bg-surface [&>*]:text-text', className)} {...rest}>
      {children}
    </select>
  )
})

export function GField({ label, children, className }: { label: string; children: ReactNode; className?: string }): React.JSX.Element {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  )
}

type Tone = 'neutral' | 'primary' | 'go' | 'stop' | 'danger'
const tones: Record<Tone, string> = {
  neutral: 'bg-text/[0.08] text-text hover:bg-text/[0.14]',
  primary: 'bg-accent text-on-accent hover:bg-accent/90',
  go: 'bg-success/30 text-text hover:bg-success/45',
  stop: 'bg-danger/30 text-text hover:bg-danger/45',
  danger: 'bg-danger/15 text-danger hover:bg-danger/25'
}

/** Yuvarlak hap düğme */
export function Pill({
  tone = 'neutral',
  size = 'md',
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; size?: 'sm' | 'md' }): React.JSX.Element {
  return (
    <button
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-medium transition active:scale-95 disabled:pointer-events-none disabled:opacity-40',
        size === 'sm' ? 'h-8 px-3.5 text-xs' : 'h-10 px-5 text-sm',
        tones[tone],
        className
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

export function IconBtn({ className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>): React.JSX.Element {
  return (
    <button
      className={cn(
        'grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted transition hover:bg-text/10 hover:text-text disabled:pointer-events-none disabled:opacity-30',
        className
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

export function GSegmented<T extends string>({
  value,
  onChange,
  options
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode }[]
}): React.JSX.Element {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl border border-text/15 bg-text/[0.05] p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'h-8 flex-1 rounded-lg px-2.5 text-xs font-semibold transition',
            value === o.value ? 'bg-accent text-on-accent shadow-sm' : 'text-muted hover:bg-text/10 hover:text-text'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function GSwitch({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }): React.JSX.Element {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-center gap-3 rounded-xl border border-text/15 bg-text/[0.05] px-3 py-2.5 text-left">
      <span className={cn('relative h-5 w-9 shrink-0 rounded-full transition', checked ? 'bg-accent' : 'bg-text/20')}>
        <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all', checked ? 'left-[18px]' : 'left-0.5')} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-text">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </button>
  )
}

/** Cam panelli diyalog  */
export function GlassModal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 520
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: number
}): React.JSX.Element | null {
  useOverlayFlag(open)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  // Portal body altına gider; cam değişkenleri için `.lg-scene` sınıfını burada da veririz
  return createPortal(
    <div className="lg-scene fixed inset-0 z-50 flex items-center justify-center p-5">
      <div className="absolute inset-0 animate-fade-in bg-black/45 backdrop-blur-md" onClick={onClose} />
      <div className="glass relative flex max-h-[92vh] w-full animate-scale-in flex-col rounded-[28px]" style={{ maxWidth: width }} role="dialog" aria-modal="true">
        <div className="absolute inset-0 -z-10 rounded-[inherit] bg-bg/60" />
        <div className="flex items-start justify-between gap-4 px-6 pb-3 pt-5">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-text">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
          </div>
          <IconBtn onClick={onClose} aria-label="Kapat" className="mt-0.5">
            <X size={16} />
          </IconBtn>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-text/10 px-6 py-4">{footer}</div>}
      </div>
    </div>,
    document.body
  )
}
