// Claude aboneliğiyle (Pro/Max) çalışmak için kullanıcının bilgisayarında kurulu
// Claude Code CLI'ını (`claude`) çalıştırır. API anahtarı gerekmez; CLI kendi
// girişini (claude.ai hesabı) kullanır.
import { app, type WebContents } from 'electron'
import { execFile, spawn, type ChildProcess } from 'child_process'
import { existsSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import type { AiStreamEvent, CliChatRequest, CliStatus } from '../shared/types'

const isWin = process.platform === 'win32'

/** `claude` komutunu bul: önce bilinen kurulum yolları, sonra PATH */
function resolveCommand(): string {
  const candidates = isWin
    ? [join(homedir(), '.local', 'bin', 'claude.exe'), join(process.env.APPDATA ?? '', 'npm', 'claude.cmd')]
    : [join(homedir(), '.local', 'bin', 'claude'), '/usr/local/bin/claude', '/opt/homebrew/bin/claude']
  return candidates.find((p) => p && existsSync(p)) ?? 'claude'
}

/** .cmd dosyaları ve PATH araması Windows'ta kabuk gerektirir */
const needsShell = (cmd: string): boolean => isWin && !cmd.toLowerCase().endsWith('.exe')
const quote = (s: string): string => (/[\s"]/.test(s) ? `"${s.replace(/"/g, '\\"')}"` : s)

export function status(): Promise<CliStatus> {
  const cmd = resolveCommand()
  return new Promise((resolve) => {
    const done = (err: Error | null, stdout: string): void => {
      if (err) resolve({ installed: false })
      else resolve({ installed: true, version: stdout.trim().split(/\s+/)[0] })
    }
    if (needsShell(cmd)) {
      execFile(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', `${quote(cmd)} --version`], { timeout: 15000, windowsHide: true }, (e, out) =>
        done(e, String(out))
      )
    } else {
      execFile(cmd, ['--version'], { timeout: 15000, windowsHide: true }, (e, out) => done(e, String(out)))
    }
  })
}

const MODEL_ALIAS: Record<string, string> = {
  'claude-opus-5-5': 'opus',
  'claude-sonnet-5-5': 'sonnet',
  'claude-haiku-5-5': 'haiku'
}

// Sistem istemi komut satırından geçtiği için kısa ve ASCII tutulur; asıl
// talimatlar ve veriler stdin üzerinden gönderilen mesajın içindedir.
const CLI_SYSTEM =
  'You are a study coach for a student preparing for YKS (the Turkish university entrance exam). ' +
  'The user message contains your full instructions, the student data and the conversation. ' +
  'Follow those instructions and always answer in Turkish using Markdown.'

const running = new Map<string, ChildProcess>()

function killTree(child: ChildProcess): void {
  if (!child.pid) return
  if (isWin) spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true })
  else child.kill('SIGTERM')
}

export function chat(sender: WebContents, req: CliChatRequest): void {
  const send = (ev: AiStreamEvent): void => {
    if (!sender.isDestroyed()) sender.send('ai:event', ev)
  }
  const cmd = resolveCommand()
  const args = [
    '-p',
    '--output-format',
    'stream-json',
    '--verbose',
    '--include-partial-messages',
    '--no-session-persistence',
    '--tools',
    '',
    '--model',
    MODEL_ALIAS[req.model] ?? 'sonnet',
    '--system-prompt',
    CLI_SYSTEM
  ]
  let child: ChildProcess
  try {
    const opts = { cwd: app.getPath('userData'), windowsHide: true, env: { ...process.env } }
    // ANTHROPIC_API_KEY tanımlıysa CLI aboneliğin yerine onu kullanır — aboneliği zorla
    delete opts.env.ANTHROPIC_API_KEY
    child = needsShell(cmd)
      ? spawn(
          process.env.ComSpec ?? 'cmd.exe',
          ['/d', '/s', '/c', `"${[cmd, ...args].map((a) => (a === '' ? '""' : quote(a))).join(' ')}"`],
          { ...opts, windowsVerbatimArguments: true }
        )
      : spawn(cmd, args, opts)
  } catch (err) {
    send({ requestId: req.requestId, type: 'error', message: `Claude CLI başlatılamadı: ${String(err)}` })
    return
  }
  running.set(req.requestId, child)

  let buf = ''
  let stderr = ''
  let finished = false
  let gotText = false
  const finish = (ev: AiStreamEvent): void => {
    if (finished) return
    finished = true
    running.delete(req.requestId)
    send(ev)
  }

  child.stdout?.setEncoding('utf8')
  child.stdout?.on('data', (chunk: string) => {
    buf += chunk
    let nl: number
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim()
      buf = buf.slice(nl + 1)
      if (!line) continue
      let msg: Record<string, unknown>
      try {
        msg = JSON.parse(line)
      } catch {
        continue
      }
      if (msg.type === 'stream_event') {
        const ev = msg.event as { type?: string; delta?: { type?: string; text?: string } } | undefined
        if (ev?.type === 'content_block_delta' && ev.delta?.type === 'text_delta' && ev.delta.text) {
          gotText = true
          send({ requestId: req.requestId, type: 'text', text: ev.delta.text })
        }
      } else if (msg.type === 'result') {
        const text = typeof msg.result === 'string' ? msg.result : ''
        if (msg.is_error) {
          finish({ requestId: req.requestId, type: 'error', message: explain(text || stderr) })
        } else {
          if (!gotText && text) send({ requestId: req.requestId, type: 'text', text })
          finish({ requestId: req.requestId, type: 'done', stopReason: (msg.stop_reason as string) ?? 'end_turn', model: req.model })
        }
      }
    }
  })
  child.stderr?.setEncoding('utf8')
  child.stderr?.on('data', (c: string) => (stderr += c))
  child.on('error', (err) => {
    finish({
      requestId: req.requestId,
      type: 'error',
      message: `Claude CLI bulunamadı veya çalıştırılamadı (${err.message}). AI Koç sayfasındaki kurulum adımlarını uygula.`
    })
  })
  child.on('close', (code) => {
    if (aborted.delete(req.requestId)) {
      finish({ requestId: req.requestId, type: 'done', stopReason: 'aborted', model: req.model })
      return
    }
    finish(
      code === 0
        ? { requestId: req.requestId, type: 'done', stopReason: 'end_turn', model: req.model }
        : { requestId: req.requestId, type: 'error', message: explain(stderr || `Claude CLI ${code} koduyla kapandı.`) }
    )
  })

  child.stdin?.end(req.prompt, 'utf8')
}

const aborted = new Set<string>()

export function abort(requestId: string): void {
  const child = running.get(requestId)
  if (!child) return
  aborted.add(requestId)
  killTree(child)
}

function explain(raw: string): string {
  const t = raw.trim()
  if (/log ?in|not logged|authenticat|\/login|oauth|credential/i.test(t)) {
    return 'Claude CLI\'da giriş yapılmamış. Başlat menüsünden "Komut İstemi"ni (cmd) aç, `claude` yazıp Enter\'a bas ve Claude hesabınla giriş yap. Sonra burada tekrar dene.'
  }
  if (/rate|limit|usage/i.test(t)) return `Abonelik kullanım sınırına ulaşılmış olabilir: ${t.slice(0, 300)}`
  return t.slice(0, 500) || 'Bilinmeyen hata'
}
