// Uygulamanın giriş noktası. İndirilmiş daha yeni bir güncelleme paketi varsa onu,
// yoksa kurulumla gelen paketi yükler. Yeni paket açılışta çökerse bir sonraki
// açılışta otomatik olarak eski pakete dönülür.
import { app } from 'electron'
import { existsSync, readFileSync, unlinkSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { isNewer } from './version'

const dir = join(app.getPath('userData'), 'updates')
const badFile = join(dir, 'bad.json')
const bootingFile = join(dir, 'booting')

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as T
  } catch {
    return fallback
  }
}

let loaded = false
try {
  mkdirSync(dir, { recursive: true })
  const bad = readJson<string[]>(badFile, [])
  // Önceki açılış "booting" işaretini temizleyemediyse o sürüm bozuktur
  if (existsSync(bootingFile)) {
    const v = readFileSync(bootingFile, 'utf8').trim()
    if (v && !bad.includes(v)) bad.push(v)
    writeFileSync(badFile, JSON.stringify(bad))
    unlinkSync(bootingFile)
  }
  const cur = readJson<{ version?: string; path?: string } | null>(join(dir, 'current.json'), null)
  if (
    cur?.version &&
    cur.path &&
    isNewer(cur.version, __APP_VERSION__) &&
    !bad.includes(cur.version) &&
    existsSync(join(cur.path, 'main', 'index.js'))
  ) {
    writeFileSync(bootingFile, cur.version)
    require(join(cur.path, 'main', 'index.js'))
    loaded = true
  }
} catch (err) {
  console.error('Güncelleme paketi yüklenemedi, kurulu sürüm açılıyor:', err)
}

if (!loaded) require(join(__dirname, 'index.js'))
