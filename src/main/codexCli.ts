// ChatGPT aboneliğiyle (Plus/Pro) çalışmak için kullanıcının bilgisayarında kurulu
// OpenAI Codex CLI'ını (`codex exec`) çalıştırır. API anahtarı gerekmez; CLI
// `codex login` ile ChatGPT hesabına bağlanır.
import { app, type WebContents } from 'electron'
import { execFile, spawn, type ChildProcess } from 'child_process'
import { existsSync, readFileSync, rmSync } from 'fs'
import { homedir, tmpdir } from 'os'
import { join } from 'path'
import { randomBytes } from 'crypto'
import type { AiStreamEvent, CliChatRequest, CliStatus } from '../shared/types'
import { killTree, needsShell, quote } from './claudeCli'

const isWin = process.platform === 'win32'

function resolveCommand(): string {
  const candidates = isWin
    ? [join(process.env.APPDATA ?? '', 'npm', 'codex.cmd'), join(homedir(), '.local', 'bin', 'codex.exe')]
    : [join(homedir(), '.local', 'bin', 'codex'), '/usr/local/bin/codex', '/opt/homebrew/bin/codex']
  return candidates.find((p) => p && existsSync(p)) ?? 'codex'
}

function run(args: string[], timeout = 15000): Promise<{ ok: boolean; out: string }> {
  const cmd = resolveCommand()
  return new Promise((resolve) => {
    const cb = (e: Error | null, out: string | Buffer, err: string | Buffer): void =>
      resolve({ ok: !e, out: `${String(out)}\n${String(err)}`.trim() })
    if (needsShell(cmd)) {
      execFile(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', [quote(cmd), ...args].join(' ')], { timeout, windowsHide: true, maxBuffer: 64 * 1024 * 1024 }, cb)
    } else execFile(cmd, args, { timeout, windowsHide: true, maxBuffer: 64 * 1024 * 1024 }, cb)
  })
}

export async function status(): Promise<CliStatus> {
  const v = await run(['--version'])
  if (!v.ok) return { installed: false }
  const login = await run(['login', 'status'])
  return {
    installed: true,
    version: v.out.split(/\s+/).find((x) => /\d+\.\d+/.test(x)),
    loggedIn: login.ok && !/not logged in/i.test(login.out)
  }
}

const running = new Map<string, ChildProcess>()
const aborted = new Set<string>()

/** JSONL olaylarından metin çıkarır: agent_message öğelerinin metni */
function agentText(ev: Record<string, unknown>): { id: string; text: string } | null {
  const item = ev.item as { id?: string; type?: string; text?: string; item_type?: string } | undefined
  if (!item) return null
  const type = item.type ?? item.item_type
  if ((type === 'agent_message' || type === 'assistant_message') && typeof item.text === 'string') {
    return { id: item.id ?? 'msg', text: item.text }
  }
  return null
}

export interface CodexModel {
  slug: string
  name: string
}

const FALLBACK_MODELS: CodexModel[] = ['gpt-6-sol', 'gpt-6-luna', 'gpt-6-astra', 'gpt-5.6-sol', 'gpt-5.5'].map((slug) => ({ slug, name: slug }))
let modelCache: CodexModel[] | null = null

/** Codex'in model kataloğu (kullanıcının hesabına göre); alınamazsa sabit liste */
export async function models(): Promise<CodexModel[]> {
  if (modelCache) return modelCache
  const r = await run(['debug', 'models'], 45000)
  try {
    const json = JSON.parse(r.out.slice(r.out.indexOf('{'))) as {
      models?: { slug: string; display_name?: string; visibility?: string; priority?: number }[]
    }
    const list = (json.models ?? [])
      .filter((m) => m.visibility !== 'hide' && !/review/i.test(m.slug))
      .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
      .map((m) => ({ slug: m.slug, name: m.display_name || m.slug }))
    if (list.length) return (modelCache = list)
  } catch {
    /* yedek liste */
  }
  return FALLBACK_MODELS
}

/** `codex login` — tarayıcıda ChatGPT girişini açar, tamamlanınca döner */
export function login(): Promise<{ ok: boolean; message: string }> {
  return run(['login'], 5 * 60000).then((r) => ({ ok: r.ok, message: r.out.slice(-300) }))
}

const isModelUnsupported = (msg: string): boolean => /not supported when using codex with a chatgpt account|model .*not supported|model_not_found|does not exist/i.test(msg)

/**
 * Sohbet isteği. Seçilen model ChatGPT hesabında desteklenmiyorsa katalogdaki
 * sıradaki modelle otomatik yeniden dener; çalışan model 'done' olayında bildirilir.
 */
export async function chat(sender: WebContents, req: CliChatRequest): Promise<void> {
  const catalog = await models()
  const queue = [req.model || undefined, ...catalog.map((m) => m.slug).filter((s) => s !== req.model)]
  const tryNext = (): void => {
    const model = queue.shift()
    runOnce(sender, { ...req, model: model ?? '' }, (msg) => {
      // Hata mesajındaki desteklenmeyen modeli kuyruktan çıkar (varsayılan model de olabilir)
      const bad = msg.match(/'([\w.-]+)' model/)?.[1]
      if (bad) for (let i = queue.length - 1; i >= 0; i--) if (queue[i] === bad) queue.splice(i, 1)
      if (isModelUnsupported(msg) && queue.length && !aborted.has(req.requestId)) {
        tryNext()
        return true
      }
      return false
    })
  }
  tryNext()
}

function runOnce(sender: WebContents, req: CliChatRequest, retry: (errorMessage: string) => boolean): void {
  const send = (ev: AiStreamEvent): void => {
    if (!sender.isDestroyed()) sender.send('ai:event', ev)
  }
  const outFile = join(tmpdir(), `yks-codex-${randomBytes(4).toString('hex')}.txt`)
  const images = (req.attachments ?? []).filter((a) => a.mime.startsWith('image/'))
  const args = [
    'exec',
    '--json',
    '--skip-git-repo-check',
    '--ephemeral',
    '-s',
    'read-only',
    '-C',
    app.getPath('userData'),
    '-o',
    outFile,
    ...(req.model ? ['-m', req.model] : []),
    ...images.flatMap((a) => ['-i', a.rel])
  ]
  const cmd = resolveCommand()
  let child: ChildProcess
  try {
    const opts = { cwd: app.getPath('userData'), windowsHide: true, env: { ...process.env } }
    // OPENAI_API_KEY tanımlıysa abonelik yerine API kullanılabilir — aboneliği zorla
    delete opts.env.OPENAI_API_KEY
    child = needsShell(cmd)
      ? spawn(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', `"${[cmd, ...args].map(quote).join(' ')}"`], {
          ...opts,
          windowsVerbatimArguments: true
        })
      : spawn(cmd, args, opts)
  } catch (err) {
    send({ requestId: req.requestId, type: 'error', message: `Codex başlatılamadı: ${String(err)}` })
    return
  }
  running.set(req.requestId, child)

  let finished = false
  const finish = (ev: AiStreamEvent): void => {
    if (finished) return
    finished = true
    running.delete(req.requestId)
    rmSync(outFile, { force: true })
    send(ev)
  }

  // Her agent_message öğesi için gönderilen metni izle, yalnızca yeni kısmı gönder
  const sent = new Map<string, number>()
  let streamed = ''
  let lastError = ''
  let buf = ''
  let stderr = ''
  child.stdout?.setEncoding('utf8')
  child.stdout?.on('data', (chunk: string) => {
    buf += chunk
    let nl: number
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim()
      buf = buf.slice(nl + 1)
      if (!line.startsWith('{')) continue
      let ev: Record<string, unknown>
      try {
        ev = JSON.parse(line)
      } catch {
        continue
      }
      const t = agentText(ev)
      if (t) {
        const prev = sent.get(t.id) ?? 0
        if (t.text.length > prev) {
          let delta = t.text.slice(prev)
          // Yeni bir mesaj öğesi başlıyorsa paragraf boşluğu bırak
          if (prev === 0 && streamed) delta = '\n\n' + delta
          streamed += delta
          sent.set(t.id, t.text.length)
          send({ requestId: req.requestId, type: 'text', text: delta })
        }
      }
      if (ev.type === 'error' || ev.type === 'turn.failed') {
        const e = (ev.error as { message?: string } | undefined)?.message ?? (ev.message as string | undefined)
        if (e) lastError = e
      }
    }
  })
  child.stderr?.setEncoding('utf8')
  child.stderr?.on('data', (c: string) => (stderr += c))
  child.on('error', (err) =>
    finish({ requestId: req.requestId, type: 'error', message: `Codex CLI bulunamadı (${err.message}). AI Koç sayfasındaki kurulum adımlarını uygula.` })
  )
  child.on('close', (code) => {
    if (aborted.delete(req.requestId)) {
      finish({ requestId: req.requestId, type: 'done', stopReason: 'aborted', model: req.model || 'codex' })
      return
    }
    let full = ''
    try {
      full = readFileSync(outFile, 'utf8').trim()
    } catch {
      /* dosya yok */
    }
    if (code === 0 && (full || streamed)) {
      if (!streamed && full) send({ requestId: req.requestId, type: 'text', text: full })
      finish({ requestId: req.requestId, type: 'done', stopReason: 'end_turn', model: req.model || 'codex', fullText: full || streamed })
    } else {
      const raw = lastError || stderr || `Codex ${code} koduyla kapandı.`
      // Model hesapta desteklenmiyorsa sessizce sıradaki modeli dene
      if (!streamed && retry(raw)) {
        finished = true
        running.delete(req.requestId)
        rmSync(outFile, { force: true })
        return
      }
      finish({ requestId: req.requestId, type: 'error', message: explain(raw) })
    }
  })
  child.stdin?.end(req.prompt, 'utf8')
}

export function abort(requestId: string): void {
  const child = running.get(requestId)
  if (!child) return
  aborted.add(requestId)
  killTree(child)
}

function explain(raw: string): string {
  const t = raw.trim()
  if (isModelUnsupported(t)) {
    return 'Seçilen model ChatGPT hesabında desteklenmiyor ve denenen diğer modeller de çalışmadı. AI Koç\'ta üstteki menüden başka bir ChatGPT modeli seç.'
  }
  if (/log ?in|not logged|unauthori|401|auth/i.test(t)) {
    return 'Codex CLI\'da giriş yapılmamış. Komut İstemi\'ni aç, `codex login` yaz ve ChatGPT hesabınla giriş yap. Sonra burada tekrar dene.'
  }
  if (/rate|limit|usage|quota/i.test(t)) return `ChatGPT kullanım sınırına ulaşılmış olabilir: ${t.slice(0, 300)}`
  return t.slice(-600) || 'Bilinmeyen hata'
}
