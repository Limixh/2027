// Kitap PDF'leri: açma (yalnızca gereken baytlar okunur), sayfa çizme, soruları bulma ve kesme.
// Soru bulma iki yolla: PDF'te metin varsa "7." gibi numaralardan; taranmış PDF'te sayfa görüntüsündeki
// renkli, hizalı soru numaralarından. Bulunamazsa kullanıcı sayfada sürükleyerek seçer.
import * as pdfjs from 'pdfjs-dist'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { fileUrl } from './files'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

/** Sayfaya göre 0–1 arası kutu */
export interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
  /** Soru numarası (PDF metninden ya da numara görüntüsünden okunduysa) */
  number?: number
  /** Numaranın sayfadaki yeri (görüntüden okumak için) */
  mark?: { x0: number; y0: number; x1: number; y1: number }
}

export interface Detection {
  boxes: Box[]
  method: 'text' | 'color' | 'none'
}

const CHUNK = 1 << 20
const docs = new Map<string, Promise<PDFDocumentProxy>>()

/** Masaüstünde yks-file://, geliştirmede doğrudan adres (test için) */
const urlOf = (rel: string): string => (/^(https?:|\/@fs\/)/.test(rel) ? rel : fileUrl(rel))

/** Bu boyuta kadar kitap tek seferde okunur (yerel diskten saniyeler); daha büyükse parça parça */
const WHOLE_LIMIT = 512 * 1024 * 1024

async function load(rel: string): Promise<PDFDocumentProxy> {
  const url = urlOf(rel)
  if (!url) throw new Error('Kitaplar yalnızca masaüstü uygulamasında açılır')
  // İlk parça + toplam boyut
  const first = await fetch(url, { headers: { Range: `bytes=0-${CHUNK - 1}` } })
  if (!first.ok) throw new Error('Kitap dosyası okunamadı')
  const total = Number(first.headers.get('Content-Range')?.split('/')[1] ?? first.headers.get('Content-Length') ?? 0)
  const head = new Uint8Array(await first.arrayBuffer())
  if (!total || head.length >= total) return pdfjs.getDocument({ data: head }).promise
  // Taranmış kitaplarda pdf.js açılışta zaten dosyanın çoğunu okur; parça parça okumak çok yavaş kalır
  if (total <= WHOLE_LIMIT) {
    const all = await fetch(url)
    if (!all.ok) throw new Error('Kitap dosyası okunamadı')
    // Veri arka plan işçisine kopyalanmadan aktarılır (bellekte iki kopya olmasın)
    return pdfjs.getDocument({ data: new Uint8Array(await all.arrayBuffer()) }).promise
  }
  const transport = new pdfjs.PDFDataRangeTransport(total, head)
  transport.requestDataRange = (begin: number, end: number): void => {
    void fetch(url, { headers: { Range: `bytes=${begin}-${end - 1}` } })
      .then((r) => r.arrayBuffer())
      .then((b) => transport.onDataRange(begin, new Uint8Array(b)))
  }
  return pdfjs.getDocument({ range: transport, length: total, rangeChunkSize: CHUNK, disableAutoFetch: true, disableStream: true }).promise
}

let releaseTimer: ReturnType<typeof setTimeout> | undefined

/**
 * Açık kitaplar yüzlerce MB bellek tutar: soru seçici kapandıktan bir süre sonra bırakılır
 * (bu sürede tekrar açılırsa beklemeden devam edilir).
 */
export function releaseBooksLater(ms = 3 * 60 * 1000): void {
  clearTimeout(releaseTimer)
  releaseTimer = setTimeout(() => {
    for (const p of docs.values()) void p.then((d) => d.destroy()).catch(() => undefined)
    docs.clear()
    pageCache.length = 0
  }, ms)
}

/** Aynı kitap uygulama açık kaldıkça bir kez açılır */
export function openBook(rel: string): Promise<PDFDocumentProxy> {
  clearTimeout(releaseTimer)
  let p = docs.get(rel)
  if (!p) {
    p = load(rel)
    p.catch(() => docs.delete(rel))
    docs.set(rel, p)
  }
  return p
}

/** Sayfayı verilen genişlikte tuvale çiz */
export async function renderPage(page: PDFPageProxy, width: number): Promise<HTMLCanvasElement> {
  const base = page.getViewport({ scale: 1 })
  const vp = page.getViewport({ scale: width / base.width })
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(vp.width)
  canvas.height = Math.ceil(vp.height)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvas, canvasContext: ctx, viewport: vp }).promise
  return canvas
}

/** Çizilmiş sayfa: tespit ve kesme aynı görüntüyü kullanır (taranmış sayfayı çözmek pahalı) */
export interface PageImage {
  page: PDFPageProxy
  canvas: HTMLCanvasElement
}

const pageCache: { key: string; img: Promise<PageImage> }[] = []

/** Sayfayı bir kez, kesmeye yetecek çözünürlükte (en fazla 1700 px genişlik) çiz; son 6 sayfa saklanır */
export function loadPage(doc: PDFDocumentProxy, n: number): Promise<PageImage> {
  const key = `${doc.fingerprints[0]}#${n}`
  const hit = pageCache.find((c) => c.key === key)
  if (hit) return hit.img
  const img = (async () => {
    const page = await doc.getPage(n)
    const native = page.getViewport({ scale: 1 }).width
    return { page, canvas: await renderPage(page, Math.min(1700, Math.max(1000, native))) }
  })()
  img.catch(() => pageCache.splice(pageCache.findIndex((c) => c.key === key), 1))
  pageCache.unshift({ key, img })
  pageCache.length = Math.min(pageCache.length, 6)
  return img
}

/** Kutuyu sayfa görüntüsünden kes → JPEG (base64, önek yok) */
export function cropImage(img: PageImage, box: Box): string {
  const c = img.canvas
  const sx = Math.round(box.x0 * c.width)
  const sy = Math.round(box.y0 * c.height)
  const sw = Math.max(1, Math.round((box.x1 - box.x0) * c.width))
  const sh = Math.max(1, Math.round((box.y1 - box.y0) * c.height))
  const out = document.createElement('canvas')
  out.width = sw
  out.height = sh
  const ctx = out.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, sw, sh)
  ctx.drawImage(c, sx, sy, sw, sh, 0, 0, sw, sh)
  return out.toDataURL('image/jpeg', 0.9).split(',')[1]
}

/* ---------------- soru bulma ---------------- */

interface Marker {
  x: number
  y: number
  /** leke boyu (sayfa yüksekliğine oranla) */
  h?: number
  number?: number
  /** numara lekesinin kutusu (0–1) */
  bb?: Box['mark']
}

/** Mürekkep (yazı / çizim) mi? Açık renkli kutu zeminleri ve filigran sayılmaz */
const isInk = (r: number, g: number, b: number): boolean => {
  const lum = (r + g + b) / 3
  return lum < 190 || (Math.max(r, g, b) - Math.min(r, g, b) > 70 && lum < 225)
}

class Ink {
  readonly w: number
  readonly h: number
  private readonly ink: Uint8Array
  constructor(canvas: HTMLCanvasElement) {
    this.w = canvas.width
    this.h = canvas.height
    const d = canvas.getContext('2d')!.getImageData(0, 0, this.w, this.h).data
    this.ink = new Uint8Array(this.w * this.h)
    for (let i = 0; i < this.ink.length; i++) if (isInk(d[i * 4], d[i * 4 + 1], d[i * 4 + 2])) this.ink[i] = 1
  }
  /**
   * [x0,x1) aralığında y satırında yazı var mı. Birkaç piksellik mürekkep (sütun ayırıcı çizgi,
   * çerçeve kenarları) yazı sayılmaz; yoksa bu çizgiler satırlar arası boşlukları yok eder.
   */
  row(y: number, x0: number, x1: number, min = 9): boolean {
    const o = y * this.w
    let n = 0
    for (let x = x0; x < x1; x++) if (this.ink[o + x] && ++n >= min) return true
    return false
  }
  /** Kırpmada yazı sayılan sütun: boş değil ama boydan boya çizgi (sütun ayırıcı / çerçeve kenarı) de değil */
  content(x: number, y0: number, y1: number): boolean {
    let n = 0
    for (let y = y0; y < y1; y++) if (this.ink[y * this.w + x]) n++
    return n >= 4 && n < (y1 - y0) * 0.8
  }
}

/** PDF metninden soru numaraları ("7." / "7)") */
async function textMarkers(page: PDFPageProxy): Promise<Marker[]> {
  const vp = page.getViewport({ scale: 1 })
  const tc = await page.getTextContent()
  const out: Marker[] = []
  for (const it of tc.items) {
    if (!('str' in it)) continue
    const m = it.str.match(/^\s*(\d{1,3})\s*[.)]\s*/)
    if (!m) continue
    const [x, y] = [it.transform[4] / vp.width, 1 - (it.transform[5] + it.height) / vp.height]
    out.push({ x, y, number: Number(m[1]) })
  }
  // Satır başındaki numaralar: aynı x hizasında birden çok kez görülenler (metin içindeki "3." gibi sayılar elenir)
  return alignedOnly(out)
}

/**
 * Taranmış sayfada renkli soru numaraları: doygun renkli küçük lekeler. Her renk tonu ayrı denenir;
 * dikey hizalı ve aralarında soru boyu boşluk olan (yazı satırı gibi sık olmayan) ton seçilir.
 */
function colorMarkers(canvas: HTMLCanvasElement, ink: Ink): Marker[] {
  const { width: W, height: H } = canvas
  const d = canvas.getContext('2d')!.getImageData(0, 0, W, H).data
  const hueOf = new Int8Array(W * H).fill(-1)
  for (let i = 0; i < W * H; i++) {
    const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2]
    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    if (max - min < 80 || (r + g + b) / 3 > 215) continue
    let h = 0
    if (max === r) h = ((g - b) / (max - min) + 6) % 6
    else if (max === g) h = (b - r) / (max - min) + 2
    else h = (r - g) / (max - min) + 4
    hueOf[i] = Math.floor(h * 2) // 12 ton kovası
  }
  // Tek geçişte bağlı bileşenler (komşu pikseller aynı ton kovasındaysa aynı leke)
  type Blob = { x0: number; y0: number; x1: number; y1: number; n: number }
  const byHue: Blob[][] = Array.from({ length: 12 }, () => [])
  const seen = new Uint8Array(W * H)
  const st: number[] = []
  for (let i = 0; i < W * H; i++) {
    const hue = hueOf[i]
    if (hue < 0 || seen[i]) continue
    let x0 = W, y0 = H, x1 = 0, y1 = 0, n = 0
    st.length = 0
    st.push(i)
    seen[i] = 1
    while (st.length) {
      const j = st.pop()!, x = j % W, y = (j / W) | 0
      n++
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
      if (x > 0 && hueOf[j - 1] === hue && !seen[j - 1]) (seen[j - 1] = 1), st.push(j - 1)
      if (x < W - 1 && hueOf[j + 1] === hue && !seen[j + 1]) (seen[j + 1] = 1), st.push(j + 1)
      if (y > 0 && hueOf[j - W] === hue && !seen[j - W]) (seen[j - W] = 1), st.push(j - W)
      if (y < H - 1 && hueOf[j + W] === hue && !seen[j + W]) (seen[j + W] = 1), st.push(j + W)
    }
    byHue[hue].push({ x0, y0, x1, y1, n })
  }
  // Uzun dikey renkli çizgiler (sütun ayırıcı, kenar süsü): kırık parçaları rakam sanılmasın
  const colSat = new Uint16Array(W)
  for (let i = 0; i < W * H; i++) if (hueOf[i] >= 0) colSat[i % W]++
  const onLine = (b: Blob): boolean => {
    for (let x = b.x0; x <= b.x1; x++) if (colSat[x] > H * 0.2) return true
    return false
  }
  const best: { score: number; markers: Marker[] } = { score: 0, markers: [] }
  for (let hue = 0; hue < 12; hue++) {
    const blobs = byHue[hue].filter((b) => !onLine(b))
    // Rakam boyutundaki lekeler; çok basamaklı sayıların rakamlarını birleştir
    const digits = blobs
      .filter((b) => b.n > 10 && b.y1 - b.y0 > H * 0.004 && b.y1 - b.y0 < H * 0.022 && b.x1 - b.x0 < W * 0.025)
      .sort((a, b) => a.x0 - b.x0)
    const merged: typeof digits = []
    for (const b of digits) {
      const m = merged.find((o) => b.x0 - o.x1 < W * 0.008 && b.x0 >= o.x0 && Math.min(o.y1, b.y1) - Math.max(o.y0, b.y0) > (b.y1 - b.y0) * 0.5)
      if (m) Object.assign(m, { x1: Math.max(m.x1, b.x1), y0: Math.min(m.y0, b.y0), y1: Math.max(m.y1, b.y1), n: m.n + b.n })
      else merged.push({ ...b })
    }
    const cand: Marker[] = merged
      .filter((b) => b.y0 > H * 0.06 && b.y1 < H * 0.94 && b.x1 - b.x0 < W * 0.04)
      // numaranın sağında (aynı satırda) soru metni başlamalı
      .filter((b) => {
        const yc = Math.round((b.y0 + b.y1) / 2)
        for (let y = Math.max(0, yc - 3); y <= Math.min(H - 1, yc + 3); y++)
          if (ink.row(y, Math.min(W - 1, b.x1 + Math.round(W * 0.012)), Math.min(W, b.x1 + Math.round(W * 0.2)))) return true
        return false
      })
      .map((b) => ({ x: b.x0 / W, y: b.y0 / H, h: (b.y1 - b.y0) / H, bb: { x0: b.x0 / W, y0: b.y0 / H, x1: (b.x1 + 1) / W, y1: (b.y1 + 1) / H } }))
    const aligned = alignedOnly(cand)
    if (aligned.length > best.score) Object.assign(best, { score: aligned.length, markers: aligned })
  }
  return best.markers
}

/**
 * Soru numarası sütunlarını seç: numaralar ya sayfanın solunda (tek / sol sütun) ya da ortasında (sağ sütun)
 * hizalıdır. Her bölgeden en kalabalık hizalı grup alınır; birbirine çok yakın tekrarlar teke indirilir;
 * dikey yazı / satır gibi sık dizilen gruplar numara sayılmaz.
 */
function alignedOnly(ms: Marker[]): Marker[] {
  const cols: Marker[][] = []
  for (const m of [...ms].sort((a, b) => a.x - b.x)) {
    const c = cols.find((c) => Math.abs(c[0].x - m.x) < 0.02)
    if (c) c.push(m)
    else cols.push([m])
  }
  const median = (xs: number[]): number => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0
  const clean = cols
    .map((c) => c.sort((a, b) => a.y - b.y))
    // Dikey yazı / satır gibi sık dizilenler numara değildir (tekrarları silmeden önce bakılır)
    .filter((c) => c.length < 3 || median(c.slice(1).map((m, i) => m.y - c[i].y)) >= 0.04)
    .map((c) => {
      // Aynı numaranın iki parçası (rakam ve nokta gibi) → tek işaret
      const u = c.filter((m, i) => i === 0 || m.y - c[i - 1].y > 0.025)
      // Bir sütundaki numaralar aynı boydadır: boyu çok farklı olan başka bir şeydir
      const mh = median(u.map((m) => m.h ?? 0))
      return mh ? u.filter((m) => !m.h || (m.h > mh * 0.6 && m.h < mh * 1.6)) : u
    })
    .filter((c) => {
      const gaps = c.slice(1).map((m, i) => m.y - c[i].y)
      return !gaps.length || median(gaps) >= 0.06
    })
  const pick = (lo: number, hi: number): Marker[] =>
    clean
      .filter((c) => c.length && c[0].x >= lo && c[0].x < hi)
      .sort((a, b) => b.length - a.length || a[0].x - b[0].x)[0] ?? []
  const left = pick(0, 0.3)
  let mid = pick(0.38, 0.62)
  // İki sütunun numaraları aynı boyda olmalı
  const lh = median(left.map((m) => m.h ?? 0)), rh = median(mid.map((m) => m.h ?? 0))
  if (left.length && mid.length && lh && rh && (rh / lh > 1.6 || lh / rh > 1.6)) mid = []
  // Sağ sütun tek başına geçerli değil (sol yoksa büyük ihtimalle gürültü), sol tek başına olabilir (tek sütunlu sayfa)
  return left.length ? [...left, ...mid] : mid.length >= 2 ? mid : []
}

/** Numaralardan soru kutuları: sütun sütun, üstten alta */
function boxesFrom(markers: Marker[], ink: Ink): Box[] {
  const { w: W, h: H } = ink
  const cols: Marker[][] = []
  for (const m of [...markers].sort((a, b) => a.x - b.x)) {
    const c = cols.find((c) => Math.abs(c[0].x - m.x) < 0.03)
    if (c) c.push(m)
    else cols.push([m])
  }
  cols.sort((a, b) => a[0].x - b[0].x)
  const boxes: Box[] = []
  cols.forEach((col, ci) => {
    col.sort((a, b) => a.y - b.y)
    const first = boxes.length
    const left = Math.max(0, Math.min(...col.map((m) => m.x)) - 0.02)
    const right = ci < cols.length - 1 ? Math.min(...cols[ci + 1].map((m) => m.x)) - 0.015 : Math.min(0.985, 1 - Math.min(...cols[0].map((m) => m.x)) + 0.04)
    const X0 = Math.round(left * W), X1 = Math.round(right * W)
    col.forEach((m, i) => {
      let top = Math.round(m.y * H)
      // Yukarı en fazla ~%5 sayfa (çerçeve başlığı); önceki sorunun içine taşmasın
      const limitTop = Math.max(i > 0 ? Math.round(col[i - 1].y * H) + Math.round(H * 0.03) : Math.round(H * 0.05), top - Math.round(H * 0.05))
      // Yukarı: numaranın üstündeki bitişik içeriği (çerçeve başlığı vb.) de al
      let gap = 0
      for (let y = top - 1; y > limitTop; y--) {
        if (ink.row(y, X0, X1)) (top = y), (gap = 0)
        else if (++gap > H * 0.008) break
      }
      const nextY = i < col.length - 1 ? Math.round(col[i + 1].y * H) - Math.round(H * 0.006) : Math.round(H * 0.97)
      // Aşağı: mürekkep blokları; sayfa altındaki küçük bloklar (cevap anahtarı, sayfa no) dahil edilmez
      const blocks: [number, number][] = []
      let start = -1, blank = 0
      for (let y = top; y < nextY; y++) {
        if (ink.row(y, X0, X1)) {
          if (start < 0) start = y
          blank = 0
        } else if (start >= 0 && ++blank > H * 0.012) {
          blocks.push([start, y - blank])
          start = -1
        }
      }
      if (start >= 0) blocks.push([start, nextY])
      // Sayfa dibindeki cevap anahtarı / sayfa numarası soruya dahil edilmez
      while (blocks.length > 1 && blocks[blocks.length - 1][0] > H * 0.905) blocks.pop()
      const bottom = blocks.length ? blocks[blocks.length - 1][1] : nextY
      // Yanlardaki boşluğu kırp
      let x0 = X0, x1 = X1
      while (x0 < x1 && !ink.content(x0, top, bottom)) x0++
      while (x1 > x0 && !ink.content(x1 - 1, top, bottom)) x1--
      const pad = 0.012
      boxes.push({
        x0: Math.max(0, x0 / W - pad),
        y0: Math.max(0, top / H - pad),
        x1: Math.min(1, x1 / W + pad),
        y1: Math.min(1, bottom / H + pad),
        number: m.number,
        mark: m.bb
      })
    })
    // Aynı sütunda bir soru bir sonrakinin üstüne taşmasın
    for (let i = first; i < boxes.length - 1; i++) boxes[i].y1 = Math.min(boxes[i].y1, boxes[i + 1].y0)
  })
  return boxes
}

/** Sayfadaki soruları bul (soldan sağa sütunlar, her sütunda yukarıdan aşağı) */
export async function detectQuestions(img: PageImage): Promise<Detection> {
  // Analiz 1000 px genişlikte (eşikler bu ölçeğe göre)
  const canvas = document.createElement('canvas')
  canvas.width = 1000
  canvas.height = Math.round((img.canvas.height / img.canvas.width) * 1000)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img.canvas, 0, 0, canvas.width, canvas.height)
  const ink = new Ink(canvas)
  const tm = await textMarkers(img.page)
  if (tm.length) return { boxes: boxesFrom(tm, ink), method: 'text' }
  const cm = colorMarkers(canvas, ink)
  if (cm.length) {
    const boxes = boxesFrom(cm, ink)
    readNumbers(canvas, boxes)
    return { boxes, method: 'color' }
  }
  return { boxes: [], method: 'none' }
}

/* ---------------- numaraları görüntüden okuma ---------------- */

/** Numara görüntüleri bu yüksekliğe ölçeklenip karşılaştırılır */
const GH = 16

interface Grid {
  w: number
  g: Uint8Array
}

/** İkili maskeyi GH yüksekliğe ölçekle (en-boy oranı korunur: genişlik basamak sayısını taşır) */
function toGrid(on: (x: number, y: number) => boolean, w: number, h: number): Grid {
  const gw = Math.max(1, Math.round((w * GH) / h))
  const g = new Uint8Array(gw * GH)
  for (let y = 0; y < GH; y++)
    for (let x = 0; x < gw; x++) {
      // hücreye düşen piksellerin yarısından fazlası doluysa dolu
      const x0 = Math.floor((x * w) / gw), x1 = Math.max(x0 + 1, Math.floor(((x + 1) * w) / gw))
      const y0 = Math.floor((y * h) / GH), y1 = Math.max(y0 + 1, Math.floor(((y + 1) * h) / GH))
      let n = 0, t = 0
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) (t++, on(xx, yy) && n++)
      g[y * gw + x] = n * 2 >= t ? 1 : 0
    }
  return { w: gw, g }
}

const templates = new Map<string, Grid>()

/** "12." yazısının kalın sans-serif şablonu */
function template(text: string): Grid {
  const hit = templates.get(text)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = 220
  c.height = 90
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.fillStyle = '#000'
  ctx.font = 'bold 64px Arial, Helvetica, sans-serif'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(text, 10, 75)
  const d = ctx.getImageData(0, 0, c.width, c.height).data
  let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++)
      if (d[(y * c.width + x) * 4 + 3] > 128) (x0 = Math.min(x0, x), x1 = Math.max(x1, x), y0 = Math.min(y0, y), y1 = Math.max(y1, y))
  const w = x1 - x0 + 1, h = y1 - y0 + 1
  const grid = toGrid((x, y) => d[((y0 + y) * c.width + x0 + x) * 4 + 3] > 128, w, h)
  templates.set(text, grid)
  return grid
}

/** İki ızgaranın örtüşmesi (sola hizalı; kesişim / birleşim) */
function iou(a: Grid, b: Grid): number {
  const w = Math.max(a.w, b.w)
  let inter = 0, uni = 0
  for (let y = 0; y < GH; y++)
    for (let x = 0; x < w; x++) {
      const p = x < a.w ? a.g[y * a.w + x] : 0
      const q = x < b.w ? b.g[y * b.w + x] : 0
      if (p && q) inter++
      if (p || q) uni++
    }
  return uni ? inter / uni : 0
}

/**
 * Taranmış sayfada soru numaralarını oku: her numara görüntüsü "n." şablonlarıyla karşılaştırılır.
 * Sayfadaki numaralar ardışık olduğu için tek tek tahmin yerine sayfa için en iyi uyan başlangıç seçilir
 * (bir rakam bulanık olsa bile dizinin geri kalanı doğru numarayı belirler).
 */
function readNumbers(canvas: HTMLCanvasElement, boxes: Box[]): void {
  if (!boxes.length || boxes.some((b) => !b.mark)) return
  const W = canvas.width, H = canvas.height
  const d = canvas.getContext('2d')!.getImageData(0, 0, W, H).data
  const colored = (x: number, y: number): boolean => {
    const i = (y * W + x) * 4
    const r = d[i], g = d[i + 1], b = d[i + 2]
    return Math.max(r, g, b) - Math.min(r, g, b) > 80 && (r + g + b) / 3 <= 215
  }
  const grids = boxes.map((b) => {
    const x0 = Math.max(0, Math.floor(b.mark!.x0 * W)), y0 = Math.max(0, Math.floor(b.mark!.y0 * H))
    const x1 = Math.min(W, Math.ceil(b.mark!.x1 * W)), y1 = Math.min(H, Math.ceil(b.mark!.y1 * H))
    return toGrid((x, y) => colored(x0 + x, y0 + y), Math.max(1, x1 - x0), Math.max(1, y1 - y0))
  })
  const score = (g: Grid, n: number): number => Math.max(iou(g, template(`${n}.`)), iou(g, template(String(n))))
  let best = { s: 0, v: 0 }
  for (let s = 1; s <= 200; s++) {
    let v = 0
    for (let i = 0; i < grids.length; i++) v += score(grids[i], s + i)
    v /= grids.length
    if (v > best.v) best = { s, v }
  }
  if (best.v < 0.45) return
  boxes.forEach((b, i) => (b.number = best.s + i))
}

/**
 * İstenen soru numarası hangi kutu: metinden numara okunduysa doğrudan; yoksa sayfadaki sıraya göre tahmin
 * (testler sayfalara eşit bölünür: 4 soruluk sayfada 7. soru = 3. kutu).
 */
export function guessIndex(boxes: Box[], question: number): number {
  if (!boxes.length || question < 1) return -1
  const exact = boxes.findIndex((b) => b.number === question)
  if (exact >= 0) return exact
  if (boxes.some((b) => b.number !== undefined)) return -1
  return question <= boxes.length ? question - 1 : (question - 1) % boxes.length
}

