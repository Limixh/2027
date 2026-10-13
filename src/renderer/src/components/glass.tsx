// Liquid Glass ortak parçaları
import { cn } from './ui'



/** Apple tarzı yuvarlak düğme */
export function RoundButton({
  children,
  onClick,
  tone = 'neutral',
  disabled
}: {
  children: React.ReactNode
  onClick: () => void
  tone?: 'neutral' | 'go' | 'stop'
  disabled?: boolean
}): React.JSX.Element {
  const tints = {
    neutral: 'text-text',
    go: 'text-text',
    stop: 'text-text'
  }
  const glow = {
    neutral: 'transparent',
    go: 'rgb(var(--success) / 0.45)',
    stop: 'rgb(var(--danger) / 0.45)'
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'glass glass-press grid h-[92px] w-[92px] place-items-center rounded-full text-[15px] font-semibold disabled:pointer-events-none disabled:opacity-35',
        tints[tone]
      )}
      style={{ backgroundColor: glow[tone] }}
    >
      {children}
    </button>
  )
}

/** Büyük, ince rakamlar */
export function BigNumber({ children, size = 'xl' }: { children: React.ReactNode; size?: 'xl' | 'lg' }): React.JSX.Element {
  return (
    <div
      className={cn(
        'tabular font-extralight leading-none tracking-tight text-text',
        size === 'xl' ? 'text-[clamp(64px,14vw,200px)]' : 'text-[clamp(48px,9vw,128px)]'
      )}
    >
      {children}
    </div>
  )
}

export type Backdrop = 'aurora' | 'plain'
export const BG_KEY = 'yks-focus-bg'

/** Cam efektinin görünmesi için arkada yavaşça dolaşan yumuşak renk kümeleri */
export function Aurora(): React.JSX.Element {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="lg-blob lg-drift-1" style={{ width: '46vw', height: '46vw', left: '-8vw', top: '-12vw', background: '#7c9cc0' }} />
      <div className="lg-blob lg-drift-2" style={{ width: '40vw', height: '40vw', right: '-10vw', top: '10vh', background: '#b39bc4' }} />
      <div className="lg-blob lg-drift-3" style={{ width: '38vw', height: '38vw', left: '24vw', bottom: '-18vw', background: '#8fb59a' }} />
      <div className="lg-blob lg-drift-2" style={{ width: '24vw', height: '24vw', right: '18vw', bottom: '4vh', background: '#d4b483', animationDelay: '-12s' }} />
    </div>
  )
}

/* ---------- Kronometre / Zamanlayıcı ortak parçaları ---------- */

/** Yuvarlak cam kadran: 60 çentik + isteğe bağlı SVG katmanı + ortada içerik.
 *  Boyut `--d` CSS değişkeniyle gelir; içerik yazı boyutunu `calc(var(--d) * k)` ile ölçekleyebilir. */
export function Dial({ svg, children }: { svg?: React.ReactNode; children?: React.ReactNode }): React.JSX.Element {
  return (
    <div
      className="glass relative grid shrink-0 place-items-center rounded-full"
      style={{ ['--d' as string]: 'min(56vh, 460px)', width: 'var(--d)', height: 'var(--d)' }}
    >
      <svg viewBox="-50 -50 100 100" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
        <circle r={37} fill="rgb(var(--bg) / 0.10)" stroke="rgb(var(--text) / 0.07)" strokeWidth={0.3} />
        {Array.from({ length: 60 }, (_, i) => {
          const major = i % 5 === 0
          return (
            <line
              key={i}
              x1={0}
              x2={0}
              y1={-48.6}
              y2={major ? -44.2 : -46.2}
              stroke={major ? 'rgb(var(--text) / 0.7)' : 'rgb(var(--text) / 0.28)'}
              strokeWidth={major ? 0.7 : 0.35}
              strokeLinecap="round"
              transform={`rotate(${i * 6})`}
            />
          )
        })}
        {svg}
      </svg>
      <div className="relative z-10 flex flex-col items-center text-center">{children}</div>
    </div>
  )
}

/** Kadranın altındaki hap biçimli cam düğme */
export function PillButton({
  children,
  onClick,
  tone = 'neutral',
  disabled,
  icon
}: {
  children: React.ReactNode
  onClick: () => void
  tone?: 'neutral' | 'go' | 'stop'
  disabled?: boolean
  icon?: React.ReactNode
}): React.JSX.Element {
  const tint = { neutral: 'transparent', go: 'rgb(var(--success) / 0.42)', stop: 'rgb(var(--danger) / 0.42)' }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="glass glass-press flex h-[52px] min-w-[132px] items-center justify-center gap-2 rounded-full px-7 text-[15px] font-semibold text-text disabled:pointer-events-none disabled:opacity-35"
      style={{ backgroundColor: tint[tone] }}
    >
      {icon}
      {children}
    </button>
  )
}

/** Küçük yuvarlak cam düğme (−5 / +5 gibi) */
export function CircleButton({
  children,
  onClick,
  disabled,
  label
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  label: string
}): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="glass glass-press grid h-12 w-12 place-items-center rounded-full text-[15px] font-semibold text-text disabled:pointer-events-none disabled:opacity-35"
    >
      {children}
    </button>
  )
}

/** Sağdaki cam liste paneli (Geri Sayım listesiyle aynı dil) */
export function GlassPanel({
  title,
  action,
  footer,
  children
}: {
  title: string
  action?: React.ReactNode
  footer?: React.ReactNode
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="glass flex min-h-0 flex-col self-center rounded-[28px] p-3">
      <div className="mb-2 flex items-center justify-between px-3 pt-1">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">{title}</span>
        {action}
      </div>
      {children}
      {footer}
    </div>
  )
}

/** Panel satırı: seçili olunca Geri Sayım listesindeki gibi parlar */
export const PANEL_ROW = 'flex items-center gap-3 rounded-2xl px-4 py-2.5 transition'
export const PANEL_ROW_ON = 'bg-white/[0.12] shadow-[inset_0_1px_0_rgb(255_255_255/0.25)]'
