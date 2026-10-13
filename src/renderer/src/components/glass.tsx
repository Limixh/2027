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
