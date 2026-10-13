// Güncelleme paketi üretir: out/ klasörünü tek bir .json.gz dosyasına koyar ve
// updates/latest.json'u yazar. Commit + push edilince kurulu uygulamalar
// bir sonraki açılışta bunu indirir.
//   npm run update:bundle -- "Sürüm notu"
import { createHash } from 'crypto'
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs'
import { join, relative } from 'path'
import { gzipSync } from 'zlib'

// Bu paketi çalıştırabilmek için gereken en düşük kurulum (exe) sürümü.
// Electron sürümü, preload/bootstrap veya yerel bağımlılıklar değişirse artır.
const MIN_SHELL = '1.1.0'

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const notes = process.argv.slice(2).join(' ').trim()
const files = {}
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p)
    else if (!p.endsWith('.map')) files[relative('out', p).split('\\').join('/')] = readFileSync(p).toString('base64')
  }
}
walk('out')
const gz = gzipSync(Buffer.from(JSON.stringify({ version: pkg.version, files })), { level: 9 })
const file = `app-${pkg.version}.json.gz`
mkdirSync('updates', { recursive: true })
for (const old of readdirSync('updates')) if (old.startsWith('app-')) rmSync(join('updates', old))
writeFileSync(join('updates', file), gz)
const manifest = {
  version: pkg.version,
  file,
  sha256: createHash('sha256').update(gz).digest('hex'),
  minShell: MIN_SHELL,
  notes: notes || undefined,
  date: new Date().toISOString().slice(0, 10)
}
writeFileSync(join('updates', 'latest.json'), JSON.stringify(manifest, null, 2) + '\n')
console.log(`updates/${file} (${(gz.length / 1024).toFixed(0)} KB) — sürüm ${pkg.version}`)
