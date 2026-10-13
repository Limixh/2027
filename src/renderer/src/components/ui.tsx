// Ortak arayüz bileşenleri (tasarım sistemi)
import { X } from 'lucide-react'
import {
  forwardRef,
  useEffect,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes
} from 'react'
import { createPortal } from 'react-dom'
import { create } from 'zustand'

export const cn = (...c: (string | false | null | undefined)[]): string => c.filter(Boolean).join(' ')

/* ---------------- Button ---------------- */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type Size = 'sm' | 'md' | 'lg' | 'icon'

const variants: Record<Variant, string> = {
  primary:
    'bg-accent text-white hover:bg-accent/90 shadow-[0_6px_20px_-8px_rgb(var(--accent)/0.8)] active:translate-y-px',
  secondary: 'bg-surface-2 text-text hover:bg-surface-3 border border-border',
  outline: 'border border-border text-text hover:bg-surface-2',
  ghost: 'text-muted hover:text-text hover:bg-surface-2',
  danger: 'bg-danger/10 text-danger hover:bg-danger/20 border border-danger/30'
}
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-sm gap-2',
  icon: 'h-8 w-8 justify-center'
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, className, children, type = 'button', ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex shrink-0 items-center rounded-lg font-medium transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
        variants[variant],
        sizes[size],
        className
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
})

/* ---------------- Card ---------------- */

export function Card({
  className,
  children,
  ...rest
}: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return (
    <div className={cn('card', className)} {...rest}>
      {children}
    </div>
  )
}

export function CardHeader({
  title,
  subtitle,
  icon,
  action,
  className
}: {
  title: ReactNode
  subtitle?: ReactNode
  icon?: ReactNode
  action?: ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <div className={cn('flex items-start justify-between gap-3 px-5 pt-4', className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        {icon && (
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent">{icon}</div>
        )}
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-text">{title}</h3>
          {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-1.5">{action}</div>}
    </div>
  )
}

/* ---------------- Form ---------------- */

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref
) {
  return <input ref={ref} className={cn('input', className)} {...rest} />
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={cn('input h-auto min-h-[80px] py-2 leading-relaxed', className)} {...rest} />
  }
)

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...rest },
  ref
) {
  return (
    <select ref={ref} className={cn('input cursor-pointer pr-8', className)} {...rest}>
      {children}
    </select>
  )
})

export function Field({
  label,
  hint,
  children,
  className
}: {
  label: ReactNode
  hint?: ReactNode
  children: ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <label className={cn('block', className)}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-subtle">{hint}</span>}
    </label>
  )
}

/** Sayı girişi — boş bırakılabilir, NaN üretmez */
export function NumberInput({
  value,
  onChange,
  min = 0,
  max,
  className,
  ...rest
}: {
  value: number | undefined
  onChange: (v: number) => void
  min?: number
  max?: number
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'min' | 'max'>): React.JSX.Element {
  return (
    <input
      type="number"
      inputMode="numeric"
      className={cn('input tabular text-center', className)}
      value={value === undefined || value === 0 ? (value === 0 ? '0' : '') : value}
      min={min}
      max={max}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => {
        let v = e.target.value === '' ? 0 : Number(e.target.value)
        if (Number.isNaN(v)) v = 0
        if (max !== undefined) v = Math.min(v, max)
        v = Math.max(v, min)
        onChange(v)
      }}
      {...rest}
    />
  )
}

/* ---------------- Segmented (sekme) ---------------- */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
  className
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode; icon?: ReactNode }[]
  size?: 'sm' | 'md'
  className?: string
}): React.JSX.Element {
  return (
    <div className={cn('inline-flex rounded-lg border border-border bg-surface-2 p-0.5', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md font-medium transition-all',
            size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3.5 text-sm',
            value === o.value ? 'bg-surface text-text shadow-sm ring-1 ring-border' : 'text-muted hover:text-text'
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ---------------- Badge ---------------- */

export function Badge({
  children,
  color,
  className
}: {
  children: ReactNode
  /** hex renk; verilmezse nötr */
  color?: string
  className?: string
}): React.JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium',
        !color && 'bg-surface-3 text-muted',
        className
      )}
      style={color ? { backgroundColor: color + '1f', color } : undefined}
    >
      {children}
    </span>
  )
}

/* ---------------- Progress ---------------- */

export function ProgressBar({
  value,
  color,
  className,
  height = 6
}: {
  /** 0..1 */
  value: number
  color?: string
  className?: string
  height?: number
}): React.JSX.Element {
  const pct = Math.max(0, Math.min(1, value)) * 100
  return (
    <div className={cn('w-full overflow-hidden rounded-full bg-surface-3', className)} style={{ height }}>
      <div
        className="h-full rounded-full transition-[width] duration-500 ease-out"
        style={{
          width: `${pct}%`,
          background: color ?? 'linear-gradient(90deg, rgb(var(--accent)), rgb(var(--accent-2)))'
        }}
      />
    </div>
  )
}

export function ProgressRing({
  value,
  size = 64,
  stroke = 7,
  color,
  children
}: {
  value: number
  size?: number
  stroke?: number
  color?: string
  children?: ReactNode
}): React.JSX.Element {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, value))
  const gid = `g${Math.round(size)}${Math.round(v * 1000)}`
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color ?? 'rgb(var(--accent))'} />
            <stop offset="100%" stopColor={color ?? 'rgb(var(--accent-2))'} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--surface-3))" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={{ transition: 'stroke-dashoffset .6s ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  )
}

/* ---------------- Stat ---------------- */

export function StatCard({
  label,
  value,
  sub,
  icon,
  accent = 'rgb(var(--accent))',
  className
}: {
  label: ReactNode
  value: ReactNode
  sub?: ReactNode
  icon?: ReactNode
  /** css renk */
  accent?: string
  className?: string
}): React.JSX.Element {
  return (
    <Card className={cn('relative overflow-hidden p-4', className)}>
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-[0.12] blur-xl"
        style={{ background: accent }}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted">{label}</span>
        {icon && (
          <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ color: accent, background: 'rgb(var(--surface-2))' }}>
            {icon}
          </span>
        )}
      </div>
      <div className="tabular mt-2 text-2xl font-semibold tracking-tight text-text">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </Card>
  )
}

/* ---------------- Empty ---------------- */

export function EmptyState({
  icon,
  title,
  description,
  action,
  className
}: {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      {icon && <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-surface-2 text-subtle">{icon}</div>}
      <div className="text-sm font-semibold text-text">{title}</div>
      {description && <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/* ---------------- Modal ---------------- */

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 560
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: number
}): React.JSX.Element | null {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 animate-fade-in bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className="card relative flex max-h-[90vh] w-full animate-scale-in flex-col overflow-hidden"
        style={{ maxWidth: width }}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Kapat">
            <X size={16} />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-border bg-surface-2/50 px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body
  )
}

/* ---------------- Onay ---------------- */

interface ConfirmState {
  req: { title: string; message?: string; confirmText?: string; danger?: boolean; resolve: (ok: boolean) => void } | null
}
const useConfirmStore = create<ConfirmState>(() => ({ req: null }))

/** `if (await confirm({ title: 'Silinsin mi?' })) ...` */
export function confirm(opts: { title: string; message?: string; confirmText?: string; danger?: boolean }): Promise<boolean> {
  return new Promise((resolve) => useConfirmStore.setState({ req: { ...opts, resolve } }))
}

export function ConfirmHost(): React.JSX.Element | null {
  const req = useConfirmStore((s) => s.req)
  const close = (ok: boolean): void => {
    req?.resolve(ok)
    useConfirmStore.setState({ req: null })
  }
  if (!req) return null
  return (
    <Modal
      open
      onClose={() => close(false)}
      title={req.title}
      width={420}
      footer={
        <>
          <Button variant="ghost" onClick={() => close(false)}>
            Vazgeç
          </Button>
          <Button variant={req.danger === false ? 'primary' : 'danger'} onClick={() => close(true)} autoFocus>
            {req.confirmText ?? 'Sil'}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted">{req.message ?? 'Bu işlem geri alınamaz.'}</p>
    </Modal>
  )
}

/* ---------------- Toast ---------------- */

interface ToastItem {
  id: number
  text: string
  kind: 'success' | 'error' | 'info'
}
const useToastStore = create<{ items: ToastItem[] }>(() => ({ items: [] }))
let toastId = 0

export function toast(text: string, kind: ToastItem['kind'] = 'success'): void {
  const id = ++toastId
  useToastStore.setState((s) => ({ items: [...s.items, { id, text, kind }] }))
  setTimeout(() => useToastStore.setState((s) => ({ items: s.items.filter((t) => t.id !== id) })), 2800)
}

export function ToastHost(): React.JSX.Element {
  const items = useToastStore((s) => s.items)
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={cn(
            'card animate-fade-in px-4 py-2.5 text-sm font-medium',
            t.kind === 'success' && 'border-success/40 text-success',
            t.kind === 'error' && 'border-danger/40 text-danger',
            t.kind === 'info' && 'text-text'
          )}
        >
          {t.text}
        </div>
      ))}
    </div>
  )
}

/* ---------------- Sayfa başlığı ---------------- */

export function PageHeader({
  title,
  description,
  actions
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}): React.JSX.Element {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/** Renkli küçük nokta */
export function Dot({ color, size = 8 }: { color: string; size?: number }): React.JSX.Element {
  return <span className="inline-block shrink-0 rounded-full" style={{ width: size, height: size, background: color }} />
}
