import { Info } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/components/ui'

/** Üzerine gelince açıklama gösteren küçük bilgi simgesi */
export function InfoTip({
  children,
  align = 'right',
  width = 280
}: {
  children: ReactNode
  align?: 'left' | 'right'
  width?: number
}): React.JSX.Element {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        tabIndex={0}
        aria-label="Bilgi"
        className="grid h-6 w-6 place-items-center rounded-md text-subtle transition hover:bg-surface-2 hover:text-text focus-visible:bg-surface-2 focus-visible:text-text focus-visible:outline-none"
      >
        <Info size={14} />
      </button>
      <span
        role="tooltip"
        style={{ width }}
        className={cn(
          'pointer-events-none invisible absolute top-full z-30 mt-1.5 rounded-xl border border-border bg-surface p-3 text-left text-xs font-normal leading-relaxed text-muted opacity-0 shadow-card transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100',
          align === 'right' ? 'right-0' : 'left-0'
        )}
      >
        {children}
      </span>
    </span>
  )
}

/** recharts için kart görünümlü tooltip kabuğu */
export function TipBox({ title, children }: { title?: ReactNode; children: ReactNode }): React.JSX.Element {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-card">
      {title && <div className="mb-1 font-semibold text-text">{title}</div>}
      <div className="space-y-0.5 text-muted">{children}</div>
    </div>
  )
}

export const AXIS_TICK = { fill: 'rgb(var(--subtle))', fontSize: 11 }

/** 0..1 oranına göre ısı hücresi arka planı (yüksek = iyi) */
export function heatBg(goodness: number): string {
  const g = Math.max(0, Math.min(1, goodness))
  return g < 0.5
    ? `rgb(var(--danger) / ${(0.07 + (0.5 - g) * 0.4).toFixed(2)})`
    : `rgb(var(--success) / ${(0.07 + (g - 0.5) * 0.36).toFixed(2)})`
}

export function heatText(goodness: number): string {
  return goodness < 0.4 ? 'rgb(var(--danger))' : goodness > 0.65 ? 'rgb(var(--success))' : 'rgb(var(--text))'
}
