// Kendi kendini güncelleme: GitHub'daki updates/latest.json'u okur, daha yeni bir
// uygulama paketi varsa indirip doğrular ve userData/updates/<sürüm> altına açar.
// Yeni paket bir sonraki açılışta (bootstrap.ts) devreye girer.
import { app, net, type WebContents } from 'electron'
import { createHash } from 'crypto'
import { existsSync, mkdirSync, readdirSync, rmSync, unlinkSync, writeFileSync } from 'fs'
import { dirname, join, normalize, sep } from 'path'
import { gunzipSync } from 'zlib'
import { isNewer } from './version'
import type { UpdateStatus } from '../shared/types'

const MANIFEST_URLS = [
  'https://raw.githubusercontent.com/Limixh/2027/HEAD/updates/latest.json',
  'https://raw.githubusercontent.com/Limixh/2027/claude/eager-darwin-kpeol5/updates/latest.json'
]

interface Manifest {
  version: string
  file: string
  sha256: string
  notes?: string
  /** Bu paketi çalıştırabilmek için gereken en düşük kurulum (exe) sürümü */
  minShell?: string
  date?: string
}

const updatesDir = (): string => join(app.getPath('userData'), 'updates')

let status: UpdateStatus = { state: 'idle', current: __APP_VERSION__ }
let listener: WebContents | null = null
let checking = false

function set(next: Partial<UpdateStatus>): void {
  status = { ...status, ...next }
  if (listener && !listener.isDestroyed()) listener.send('update:event', status)
}

export const getStatus = (): UpdateStatus => status

/** Bu sürüm sorunsuz açıldı: bootstrap'in çökme işaretini temizle */
export function markHealthy(): void {
  const f = join(updatesDir(), 'booting')
  try {
    if (existsSync(f)) unlinkSync(f)
  } catch {
    /* yoksay */
  }
}

async function fetchManifest(): Promise<{ manifest: Manifest; base: string } | null> {
  // YKS_UPDATE_URL: test için alternatif güncelleme adresi
  const urls = process.env.YKS_UPDATE_URL ? [process.env.YKS_UPDATE_URL] : MANIFEST_URLS
  for (const url of urls) {
    try {
      const res = await net.fetch(`${url}?t=${Date.now()}`, { cache: 'no-store' })
      if (!res.ok) continue
      const manifest = (await res.json()) as Manifest
      if (manifest?.version && manifest.file && manifest.sha256) return { manifest, base: url.slice(0, url.lastIndexOf('/') + 1) }
    } catch {
      /* sıradaki adres */
    }
  }
  return null
}

export async function check(sender?: WebContents): Promise<UpdateStatus> {
  if (sender) listener = sender
  if (checking || status.state === 'ready') return status
  checking = true
  try {
    set({ state: 'checking', error: undefined })
    const found = await fetchManifest()
    if (!found) {
      set({ state: 'error', error: 'Güncelleme sunucusuna ulaşılamadı (internet bağlantısını kontrol et).' })
      return status
    }
    const { manifest, base } = found
    set({ latest: manifest.version, notes: manifest.notes })
    if (!isNewer(manifest.version, __APP_VERSION__)) {
      set({ state: 'uptodate' })
      return status
    }
    if (manifest.minShell && isNewer(manifest.minShell, app.getVersion())) {
      set({ state: 'needs-reinstall' })
      return status
    }
    set({ state: 'downloading' })
    const res = await net.fetch(base + manifest.file, { cache: 'no-store' })
    if (!res.ok) throw new Error(`İndirme başarısız (${res.status})`)
    const buf = Buffer.from(await res.arrayBuffer())
    const hash = createHash('sha256').update(buf).digest('hex')
    if (hash !== manifest.sha256) throw new Error('İndirilen dosya doğrulanamadı (sha256 uyuşmuyor).')

    const payload = JSON.parse(gunzipSync(buf).toString('utf8')) as { version: string; files: Record<string, string> }
    const target = join(updatesDir(), manifest.version)
    rmSync(target, { recursive: true, force: true })
    for (const [rel, b64] of Object.entries(payload.files)) {
      const out = normalize(join(target, rel))
      if (!out.startsWith(target + sep)) throw new Error('Geçersiz dosya yolu')
      mkdirSync(dirname(out), { recursive: true })
      writeFileSync(out, Buffer.from(b64, 'base64'))
    }
    writeFileSync(join(updatesDir(), 'current.json'), JSON.stringify({ version: manifest.version, path: target }))
    // Eski paketleri temizle
    for (const name of readdirSync(updatesDir())) {
      const p = join(updatesDir(), name)
      if (/^\d+\.\d+\.\d+$/.test(name) && name !== manifest.version && name !== __APP_VERSION__) {
        rmSync(p, { recursive: true, force: true })
      }
    }
    set({ state: 'ready' })
  } catch (err) {
    set({ state: 'error', error: err instanceof Error ? err.message : String(err) })
  } finally {
    checking = false
  }
  return status
}

export function install(): void {
  app.relaunch()
  app.exit(0)
}
