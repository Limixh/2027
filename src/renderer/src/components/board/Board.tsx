// Tahtada çözüm oynatıcısı: kareli beyaz kâğıda el yazısıyla, adım adım yazılıyormuş gibi gösterir.
// İsteğe bağlı sesli anlatım (Windows'un Türkçe sesi varsa) ve tam ekran.
import '@fontsource-variable/caveat'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, GraduationCap, Maximize2, Minimize2, Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react'
import type { BoardLine, BoardSolution } from '../../../../shared/types'
import { Button, cn } from '@/components/ui'
import { pageOf } from '@/lib/board'
import { useStore } from '@/lib/store'

const INK: Record<NonNullable<BoardLine['color']>, string> = {
  ink: '#1d2a4a',
  blue: '#2457c5',
  red: '#c8372d',
  green: '#1f8a4c'
}

/** Bir satırın yazılma süresi (ms) */
const writeMs = (l: BoardLine): number => Math.min(2200, Math.max(550, (l.text.length + (l.note?.length ?? 0) * 0.5) * 48))

/** x^2, x^(n+1), a_1 → üst / alt simge */
function MathText({ text }: { text: string }): React.JSX.Element {
  const parts: React.ReactNode[] = []
  const re = /([\^_])(\([^()]*\)|[A-Za-z0-9√.]+)/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    const inner = m[2].startsWith('(') ? m[2].slice(1, -1) : m[2]
    parts.push(m[1] === '^' ? <sup key={m.index}>{inner}</sup> : <sub key={m.index}>{inner}</sub>)
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return <>{parts}</>
}

function Line({ line, delay, animate }: { line: BoardLine; delay: number; animate: boolean }): React.JSX.Element {
  const color = INK[line.color ?? 'ink']
  const d = writeMs(line)
  const mark =
    line.mark === 'circle'
      ? 'rounded-[50%] border-2 border-[#c8372d] px-3 -mx-1 -rotate-1'
      : line.mark === 'box'
        ? 'border-2 px-2.5 rounded-[3px]'
        : line.mark === 'underline'
          ? 'underline decoration-wavy decoration-2 underline-offset-[6px]'
          : line.mark === 'strike'
            ? 'line-through decoration-[#c8372d] decoration-[3px] opacity-80'
            : ''
  return (
    <div className="flex flex-wrap items-baseline gap-x-5 leading-[1.5]">
      <span
        className={cn('inline-block whitespace-pre-wrap', animate && 'board-write')}
        style={{ color, borderColor: line.mark === 'box' ? color : undefined, ['--d' as string]: `${d}ms`, ['--delay' as string]: `${delay}ms` }}
      >
        <span className={cn('inline-block', mark)}>
          <MathText text={line.text} />
        </span>
      </span>
      {line.note && (
        <span
          className={cn('text-[0.72em] text-[#c8372d]', animate && 'board-note')}
          style={{ ['--delay' as string]: `${delay + d}ms` }}
        >
          ← {line.note}
        </span>
      )}
    </div>
  )
}

function Paper({ solution, cur, big }: { solution: BoardSolution; cur: number; big?: boolean }): React.JSX.Element {
  const pages = useMemo(() => pageOf(solution.steps), [solution.steps])
  const page = pages[cur] ?? 0
  const visible = solution.steps.map((s, i) => ({ s, i })).filter(({ i }) => pages[i] === page && i <= cur)
  return (
    <div
      className={cn('relative overflow-hidden rounded-xl border border-[#d9d6cb] shadow-inner', big ? 'min-h-[62vh] px-12 py-10' : 'min-h-[340px] px-7 py-6')}
      style={{
        background: '#fbfaf5',
        backgroundImage: 'linear-gradient(#e7e9f0 1px, transparent 1px), linear-gradient(90deg, #e7e9f0 1px, transparent 1px)',
        backgroundSize: big ? '34px 34px' : '28px 28px',
        fontFamily: "'Caveat Variable', 'Segoe Print', cursive",
        fontSize: big ? 38 : 27
      }}
    >
      {visible.map(({ s, i }) => {
        // Yalnızca şu anki adımın satırları yazılıyormuş gibi gelir; öncekiler duruyor
        let delay = 0
        return (
          <Fragment key={i}>
            {s.lines.map((l, j) => {
              const el = <Line key={`${cur === i ? 'n' : 'o'}-${j}`} line={l} delay={delay} animate={cur === i} />
              delay += writeMs(l) + 150
              return el
            })}
          </Fragment>
        )
      })}
      {pages[cur] > 0 && <div className="absolute right-4 top-2 font-sans text-[11px] text-[#9a9686]">sayfa {page + 1}</div>}
    </div>
  )
}

export function Board({ solution }: { solution: BoardSolution }): React.JSX.Element {
  const steps = solution.steps
  const voiceOn = useStore((s) => s.data.settings.boardVoice ?? false)
  const updateSettings = useStore((s) => s.updateSettings)
  const [cur, setCur] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [full, setFull] = useState(false)
  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window
  const trVoice = useRef<SpeechSynthesisVoice | null>(null)
  const last = steps.length - 1
  const step = steps[cur]

  useEffect(() => {
    if (!canSpeak) return
    const pick = (): void => {
      trVoice.current = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith('tr')) ?? null
    }
    pick()
    speechSynthesis.addEventListener('voiceschanged', pick)
    return () => {
      speechSynthesis.removeEventListener('voiceschanged', pick)
      speechSynthesis.cancel()
    }
  }, [canSpeak])

  const go = useCallback((i: number) => setCur(Math.max(0, Math.min(last, i))), [last])

  // Adım değişince: (sesliyse) oku; oynatılıyorsa yazma + okuma bitince sıradakine geç
  useEffect(() => {
    const writeTime = step.lines.reduce((t, l) => t + writeMs(l) + 150, 0)
    const speak = voiceOn && canSpeak && !!step.say
    let spoken = !speak
    let written = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const advance = (): void => {
      if (!playing || !spoken || !written) return
      if (cur >= last) setPlaying(false)
      else timer = setTimeout(() => setCur((c) => c + 1), 500)
    }
    if (speak) {
      speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(step.say)
      u.lang = 'tr-TR'
      if (trVoice.current) u.voice = trVoice.current
      u.rate = 1.02
      u.onend = () => {
        spoken = true
        advance()
      }
      speechSynthesis.speak(u)
    }
    // Sessizken okuma süresi kadar bekle
    const readTime = speak ? 0 : Math.max(1800, step.say.length * 48)
    const t1 = setTimeout(() => {
      written = true
      advance()
    }, Math.max(writeTime, readTime))
    return () => {
      clearTimeout(t1)
      clearTimeout(timer)
    }
  }, [cur, playing, voiceOn, canSpeak, step, last])

  // Ses kapatılınca hemen sus
  useEffect(() => {
    if (!voiceOn && canSpeak) speechSynthesis.cancel()
  }, [voiceOn, canSpeak])

  // Tam ekranda klavye: ← → adım, boşluk oynat, Esc kapat (soru sayfasının ← → gezinmesine gitmesin)
  useEffect(() => {
    if (!full) return
    const onKey = (e: KeyboardEvent): void => {
      const k = e.key
      if (!['ArrowLeft', 'ArrowRight', ' ', 'Escape'].includes(k)) return
      e.preventDefault()
      e.stopPropagation()
      if (k === 'Escape') setFull(false)
      else if (k === ' ') setPlaying((p) => !p)
      else {
        setPlaying(false)
        go(cur + (k === 'ArrowRight' ? 1 : -1))
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [full, cur, go])

  const controls = (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button variant="ghost" size="icon" aria-label="Baştan" title="Baştan" onClick={() => (setPlaying(false), go(0))}>
        <RotateCcw size={15} />
      </Button>
      <Button variant="ghost" size="icon" aria-label="Önceki adım" disabled={cur === 0} onClick={() => (setPlaying(false), go(cur - 1))}>
        <ChevronLeft size={17} />
      </Button>
      <Button
        variant="primary"
        size="sm"
        icon={playing ? <Pause size={14} /> : <Play size={14} />}
        onClick={() => {
          if (!playing && cur >= last) go(0)
          setPlaying((p) => !p)
        }}
      >
        {playing ? 'Duraklat' : cur >= last ? 'Baştan oynat' : 'Oynat'}
      </Button>
      <Button variant="ghost" size="icon" aria-label="Sonraki adım" disabled={cur >= last} onClick={() => (setPlaying(false), go(cur + 1))}>
        <ChevronRight size={17} />
      </Button>
      <span className="tabular px-1.5 text-xs text-muted">
        {cur + 1} / {steps.length}
      </span>
      <div className="ml-auto flex items-center gap-1">
        {canSpeak && (
          <Button
            variant="ghost"
            size="sm"
            icon={voiceOn ? <Volume2 size={14} /> : <VolumeX size={14} />}
            onClick={() => updateSettings({ boardVoice: !voiceOn })}
            title={voiceOn && !trVoice.current ? 'Bilgisayarda Türkçe ses bulunamadı; varsayılan sesle okunur' : 'Adımları sesli anlat'}
          >
            {voiceOn ? 'Sesli' : 'Sessiz'}
          </Button>
        )}
        <Button variant="ghost" size="icon" aria-label={full ? 'Küçült' : 'Tam ekran'} title={full ? 'Küçült (Esc)' : 'Tam ekran'} onClick={() => setFull((f) => !f)}>
          {full ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </Button>
      </div>
    </div>
  )

  const teacher = (big?: boolean) => (
    <div key={cur} className={cn('flex animate-fade-in items-start gap-3', big ? 'text-lg' : 'text-sm')}>
      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
        <GraduationCap size={15} />
      </span>
      <p className="leading-relaxed text-text">{step.say}</p>
    </div>
  )

  return (
    <div className="space-y-3">
      <Paper solution={solution} cur={cur} />
      {teacher()}
      {controls}
      {full &&
        createPortal(
          <div role="dialog" aria-modal="true" className="fixed inset-0 z-[70] flex animate-fade-in flex-col gap-4 bg-bg/95 p-8 backdrop-blur">
            <div className="mx-auto w-full max-w-6xl flex-1 space-y-4 overflow-y-auto">
              <Paper solution={solution} cur={cur} big />
              {teacher(true)}
            </div>
            <div className="mx-auto w-full max-w-6xl">{controls}</div>
          </div>,
          document.body
        )}
    </div>
  )
}
