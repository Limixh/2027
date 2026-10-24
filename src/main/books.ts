// Kitaplık: kullanıcının soru bankası PDF'leri userData/attachments/books altında saklanır.
// Büyük PDF'ler (yüzlerce MB) belleğe alınmadan, arayüzün istediği bayt aralıkları okunarak gösterilir.
import { app, dialog } from 'electron'
import { createReadStream, mkdirSync, statSync, unlinkSync } from 'fs'
import { copyFile } from 'fs/promises'
import { basename, join, normalize, sep } from 'path'
import { randomBytes } from 'crypto'
import { Readable } from 'stream'

const booksDir = (): string => join(app.getPath('userData'), 'attachments', 'books')

export interface ImportedBook {
  rel: string
  fileName: string
  size: number
}

/** PDF seç (çoklu) ve kitaplığa kopyala */
export async function importBooks(): Promise<ImportedBook[]> {
  const res = await dialog.showOpenDialog({
    title: 'Kitap PDF’i ekle',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  })
  if (res.canceled) return []
  mkdirSync(booksDir(), { recursive: true })
  const out: ImportedBook[] = []
  for (const src of res.filePaths) {
    const file = `${randomBytes(6).toString('hex')}.pdf`
    await copyFile(src, join(booksDir(), file))
    out.push({ rel: `attachments/books/${file}`, fileName: basename(src), size: statSync(src).size })
  }
  return out
}

export function removeBook(rel: string): void {
  const full = normalize(join(app.getPath('userData'), rel))
  if (!full.startsWith(booksDir() + sep)) throw new Error('Geçersiz kitap yolu')
  try {
    unlinkSync(full)
  } catch {
    /* zaten yok */
  }
}

/** Arayüz file:// kökenli; yks-file:// farklı köken sayıldığı için fetch'e izin ver */
export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Range',
  'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges'
}

/**
 * yks-file:// isteğine bayt aralığı (Range) desteğiyle cevap: PDF görüntüleyici yalnızca
 * gereken sayfaların baytlarını ister. Aralık yoksa dosyanın tamamı akışla gönderilir.
 */
export function rangeResponse(full: string, rangeHeader: string | null, mime: string): Response {
  const size = statSync(full).size
  const m = rangeHeader?.match(/bytes=(\d*)-(\d*)/)
  if (!m || (!m[1] && !m[2])) {
    return new Response(Readable.toWeb(createReadStream(full)) as ReadableStream, {
      status: 200,
      headers: { ...CORS, 'Content-Type': mime, 'Content-Length': String(size), 'Accept-Ranges': 'bytes' }
    })
  }
  let start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]))
  let end = m[1] && m[2] ? Number(m[2]) : size - 1
  end = Math.min(end, size - 1)
  if (start > end || start >= size) return new Response('', { status: 416, headers: { ...CORS, 'Content-Range': `bytes */${size}` } })
  start = Math.max(0, start)
  return new Response(Readable.toWeb(createReadStream(full, { start, end })) as ReadableStream, {
    status: 206,
    headers: {
      ...CORS,
      'Content-Type': mime,
      'Content-Length': String(end - start + 1),
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Accept-Ranges': 'bytes'
    }
  })
}
