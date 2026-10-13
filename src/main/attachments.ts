// Sohbete eklenen dosyaları (deneme sonuç belgesi vb.) userData/attachments altında saklar.
import { app } from 'electron'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { extname, join, normalize, sep } from 'path'
import { randomBytes } from 'crypto'
import type { ChatAttachment } from '../shared/types'

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.md': 'text/markdown'
}

export const mimeOf = (name: string): string => MIME[extname(name).toLowerCase()] ?? 'application/octet-stream'

export function saveAttachment(name: string, base64: string): ChatAttachment {
  const dir = join(app.getPath('userData'), 'attachments')
  mkdirSync(dir, { recursive: true })
  const ext = extname(name).toLowerCase() || '.bin'
  if (!MIME[ext]) throw new Error('Desteklenmeyen dosya türü (resim, PDF veya metin ekleyin)')
  // Komut satırında sorun çıkmasın diye ASCII ve boşluksuz dosya adı
  const safe = name
    .slice(0, -ext.length || undefined)
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  const file = `${randomBytes(4).toString('hex')}-${safe || 'dosya'}${ext}`
  writeFileSync(join(dir, file), Buffer.from(base64, 'base64'))
  return { name, rel: `attachments/${file}`, mime: MIME[ext] }
}

/** Göreli eki güvenli şekilde okur (userData dışına çıkılamaz) */
export function readAttachment(rel: string): Buffer {
  const root = app.getPath('userData')
  const full = normalize(join(root, rel))
  if (!full.startsWith(root + sep)) throw new Error('Geçersiz ek yolu')
  return readFileSync(full)
}
