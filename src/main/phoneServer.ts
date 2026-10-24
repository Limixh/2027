// Telefondan soru fotoğrafı yükleme: yerel ağda küçük bir HTTP sunucusu açar.
// Telefon aynı Wi-Fi'da QR kodu okutup tarayıcıdan fotoğraf gönderir; bulut/hesap gerekmez.
// Her uygulama oturumunda rastgele bir anahtar (token) üretilir; anahtarı olmayan istekler reddedilir.
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'http'
import { randomBytes } from 'crypto'
import { networkInterfaces } from 'os'
import type { WebContents } from 'electron'
import { saveAttachment } from './attachments'
import { PHONE_PAGE } from './phonePage'
import type { ChatAttachment, PhoneServerInfo, PhoneUpload } from '../shared/types'

const PORTS = [47827, 47828, 47829, 0]
const MAX_BODY = 40 * 1024 * 1024

let server: Server | null = null
let port = 0
let token = ''
let catalog = '[]'
let target: WebContents | null = null
let received = 0

/** Yerel ağ IPv4 adresleri (önce ev ağı aralıkları) */
function lanAddresses(): string[] {
  const out: string[] = []
  for (const list of Object.values(networkInterfaces())) {
    for (const a of list ?? []) if (a.family === 'IPv4' && !a.internal) out.push(a.address)
  }
  const rank = (ip: string): number => (ip.startsWith('192.168.') ? 0 : ip.startsWith('10.') ? 1 : /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ? 2 : 3)
  return out.sort((a, b) => rank(a) - rank(b))
}

export const info = (): PhoneServerInfo => ({
  running: !!server,
  urls: server ? lanAddresses().map((ip) => `http://${ip}:${port}/?t=${token}`) : [],
  received
})

function send(res: ServerResponse, status: number, body: string, type = 'application/json; charset=utf-8'): void {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' })
  res.end(body)
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => {
      size += c.length
      if (size > MAX_BODY) {
        reject(new Error('Dosya çok büyük'))
        req.destroy()
      } else chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://x')
  if (url.searchParams.get('t') !== token) return send(res, 403, JSON.stringify({ error: 'Geçersiz bağlantı. QR kodu yeniden okut.' }))
  if (req.method === 'GET' && url.pathname === '/') return send(res, 200, PHONE_PAGE, 'text/html; charset=utf-8')
  if (req.method === 'GET' && url.pathname === '/api/catalog') return send(res, 200, catalog)
  if (req.method === 'POST' && url.pathname === '/api/upload') {
    try {
      const body = JSON.parse(await readBody(req)) as {
        subjectId?: string
        topicId?: string
        note?: string
        source?: string
        question?: string[]
        attempt?: string[]
        correctAnswer?: string
        myAnswer?: string
        usedSolution?: boolean
        usedHint?: boolean
        hintSeen?: string
      }
      const save = (list: string[] | undefined, prefix: string): ChatAttachment[] =>
        (list ?? []).slice(0, 6).map((b64, i) => saveAttachment(`${prefix}-${Date.now()}-${i + 1}.jpg`, b64.replace(/^data:[^,]+,/, '')))
      const question = save(body.question, 'soru')
      if (!question.length) return send(res, 400, JSON.stringify({ error: 'En az bir soru fotoğrafı ekle' }))
      const upload: PhoneUpload = {
        subjectId: body.subjectId || '',
        topicId: body.topicId || undefined,
        note: (body.note ?? '').slice(0, 2000),
        source: (body.source ?? '').slice(0, 200) || undefined,
        correctAnswer: (body.correctAnswer ?? '').slice(0, 40) || undefined,
        myAnswer: (body.myAnswer ?? '').slice(0, 40) || undefined,
        usedSolution: body.usedSolution === true || undefined,
        usedHint: (body.usedSolution !== true && body.usedHint === true) || undefined,
        hintSeen: (body.hintSeen ?? '').slice(0, 1000) || undefined,
        questionImages: question,
        attemptImages: save(body.attempt, 'cozum')
      }
      received++
      if (target && !target.isDestroyed()) target.send('phone:upload', upload)
      return send(res, 200, JSON.stringify({ ok: true, received }))
    } catch (e) {
      return send(res, 400, JSON.stringify({ error: e instanceof Error ? e.message : 'Yükleme başarısız' }))
    }
  }
  send(res, 404, JSON.stringify({ error: 'Bulunamadı' }))
}

export async function start(sender: WebContents, catalogJson: string): Promise<PhoneServerInfo> {
  target = sender
  catalog = catalogJson
  if (server) return info()
  token = randomBytes(9).toString('base64url')
  for (const p of PORTS) {
    const s = createServer((req, res) => void handle(req, res))
    const ok = await new Promise<boolean>((resolve) => {
      s.once('error', () => resolve(false))
      s.listen(p, '0.0.0.0', () => resolve(true))
    })
    if (ok) {
      server = s
      const addr = s.address()
      port = typeof addr === 'object' && addr ? addr.port : p
      break
    }
  }
  return info()
}

export function stop(): PhoneServerInfo {
  server?.close()
  server = null
  return info()
}
