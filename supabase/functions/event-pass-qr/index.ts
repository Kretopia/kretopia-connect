// event-pass-qr: the Kretopia-branded event pass QR as a PNG, for emails.
//
// An email can't run the app's qr-code-styling (no JS, and Gmail blocks data: images), so the
// confirmation / reminder emails point an <img> at this endpoint instead of a generic QR service
// (api.qrserver.com, which also received the check-in token and can't draw our design).
//
// It reproduces EventPassCard's QR: raw token as data, error correction H, rounded "extra-rounded"
// dots in a 45 degree #05070D -> #A516C5 gradient, rounded violet finder rings with a dark dot,
// the Kretopia K mark knocked out of the centre, on a white rounded card. Pure JS (no canvas/wasm)
// so it behaves the same in Node (where it is tested) and in the edge runtime.
//
// Public on purpose (emails send no JWT): it renders whatever 32-64 URL-safe characters it is given
// and reads nothing from the database.
import qrcode from 'npm:qrcode-generator@1.5.2'
import { zlibSync } from 'npm:fflate@0.8.2'
import { decode as decodePng } from 'npm:fast-png@6.4.0'

const LOGO_URL = 'https://www.kretopia.com/__l5e/assets-v1/0b662b7c-ffb2-4428-a722-862dbee073a6/kretopia-k-mark.png'

// Same numbers as EventPassCard.tsx / the in-app pass, in CSS pixels.
const QR_BOX = 240 // qr-code-styling width/height
const QR_MARGIN = 8 // qr-code-styling margin
const CARD_PAD = 12 // p-3 around the canvas
const CARD = QR_BOX + CARD_PAD * 2 // 264
const CARD_RADIUS = 16 // rounded-2xl
const LOGO_RATIO = 0.3 // imageSize
const LOGO_MARGIN = 6 // imageOptions.margin
const INK: RGB = [5, 7, 13] // MIDNIGHT #05070D
const VIOLET: RGB = [165, 22, 197] // ENERGY #A516C5

type RGB = [number, number, number]
interface Logo { w: number; h: number; rgba: Uint8Array }

// ───────────────────────── raster helpers ─────────────────────────

class Canvas {
  readonly w: number
  readonly px: Uint8ClampedArray
  // `u` work pixels per CSS pixel (output scale x supersampling)
  constructor(readonly u: number) {
    this.w = Math.round(CARD * u)
    this.px = new Uint8ClampedArray(this.w * this.w * 4)
  }

  /** Visit every work pixel whose centre is inside the logical box; `test` decides coverage. */
  paint(x0: number, y0: number, x1: number, y1: number, test: (x: number, y: number) => boolean, color: (x: number, y: number) => RGB) {
    const u = this.u
    const ia = Math.max(0, Math.floor(x0 * u)), ib = Math.min(this.w - 1, Math.ceil(x1 * u))
    const ja = Math.max(0, Math.floor(y0 * u)), jb = Math.min(this.w - 1, Math.ceil(y1 * u))
    for (let j = ja; j <= jb; j++) {
      const y = (j + 0.5) / u
      for (let i = ia; i <= ib; i++) {
        const x = (i + 0.5) / u
        if (!test(x, y)) continue
        const [r, g, b] = color(x, y)
        const o = (j * this.w + i) * 4
        this.px[o] = r; this.px[o + 1] = g; this.px[o + 2] = b; this.px[o + 3] = 255
      }
    }
  }

  /** Alpha-composite one source pixel over what is already there (used for the logo). */
  blend(i: number, j: number, r: number, g: number, b: number, a: number) {
    if (a <= 0) return
    const o = (j * this.w + i) * 4
    const da = this.px[o + 3] / 255
    const oa = a + da * (1 - a)
    this.px[o] = (r * a + this.px[o] * da * (1 - a)) / oa
    this.px[o + 1] = (g * a + this.px[o + 1] * da * (1 - a)) / oa
    this.px[o + 2] = (b * a + this.px[o + 2] * da * (1 - a)) / oa
    this.px[o + 3] = oa * 255
  }
}

const solid = (c: RGB) => () => c
const inRoundRect = (x: number, y: number, rx: number, ry: number, rw: number, rh: number, r: number) => {
  if (x < rx || x > rx + rw || y < ry || y > ry + rh) return false
  const cx = x < rx + r ? rx + r : x > rx + rw - r ? rx + rw - r : x
  const cy = y < ry + r ? ry + r : y > ry + rh - r ? ry + rh - r : y
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
}

// ───────────────────────── the QR drawing ─────────────────────────

/** qr-code-styling's "extra-rounded" dot: shape depends on which of the 4 sides touch another dark module. */
function dotShape(left: boolean, right: boolean, top: boolean, bottom: boolean) {
  const n = +left + +right + +top + +bottom
  return (x: number, y: number): boolean => { // x,y in 0..1 of the cell
    if (n === 0) return (x - 0.5) ** 2 + (y - 0.5) ** 2 <= 0.25
    if (n > 2 || (left && right) || (top && bottom)) return true
    if (n === 2) { // one big rounded corner, opposite the corner where the two neighbours meet
      const cx = left ? 0 : 1, cy = top ? 0 : 1
      return (x - cx) ** 2 + (y - cy) ** 2 <= 1
    }
    // one neighbour: flat on its side, a half disc on the other
    const half = left ? x <= 0.5 : right ? x >= 0.5 : top ? y <= 0.5 : y >= 0.5
    return half || (x - 0.5) ** 2 + (y - 0.5) ** 2 <= 0.25
  }
}

// scale 2 = a 528px PNG shown at ~190 CSS px (crisp on retina); ss 2 = 2x2 supersampling for the edges,
// which measured ~220ms CPU per render (ss 3 was ~480ms) with no visible difference at that display size.
export function renderPassQr(data: string, centreMark: Logo | null, scale = 2, ss = 2): { size: number; rgba: Uint8Array } {
  const qr = qrcode(0, 'H')
  qr.addData(data)
  qr.make()
  const n = qr.getModuleCount()
  // A 30% centre mark on a small QR exceeds what error correction H can recover (measured: 29
  // modules fails to decode, 33 and up decode on every token tried).
  const logo = n >= 33 ? centreMark : null

  const cv = new Canvas(scale * ss)
  const grid = QR_BOX - QR_MARGIN * 2
  const origin = CARD_PAD + QR_MARGIN
  const cell = grid / n

  // white rounded card (transparent corners, so it sits on the dark email like the in-app pass)
  cv.paint(0, 0, CARD, CARD, (x, y) => inRoundRect(x, y, 0, 0, CARD, CARD, CARD_RADIUS), solid([255, 255, 255]))

  // gradient across the QR box at 45 degrees, MIDNIGHT -> ENERGY
  const cx = CARD_PAD + QR_BOX / 2, cy = CARD_PAD + QR_BOX / 2, k = Math.SQRT1_2
  const gradient = (x: number, y: number): RGB => {
    const t = Math.min(1, Math.max(0, ((x - cx) * k + (y - cy) * k) / (QR_BOX * 2 * k) + 0.5))
    return [INK[0] + (VIOLET[0] - INK[0]) * t, INK[1] + (VIOLET[1] - INK[1]) * t, INK[2] + (VIOLET[2] - INK[2]) * t]
  }

  const isDark = (r: number, c: number) => r >= 0 && c >= 0 && r < n && c < n && qr.isDark(r, c)
  const inFinder = (r: number, c: number) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7)

  // knock the logo out of the middle (qr-code-styling's hideBackgroundDots)
  const logoSize = grid * LOGO_RATIO
  const clear = logo ? logoSize + LOGO_MARGIN * 2 : 0
  const mid = origin + grid / 2
  const hidden = (r: number, c: number) => {
    if (!logo) return false
    const x = origin + (c + 0.5) * cell, y = origin + (r + 0.5) * cell
    return Math.abs(x - mid) < clear / 2 + cell / 2 && Math.abs(y - mid) < clear / 2 + cell / 2
  }

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!isDark(r, c) || inFinder(r, c) || hidden(r, c)) continue
      const shape = dotShape(isDark(r, c - 1) && !inFinder(r, c - 1), isDark(r, c + 1) && !inFinder(r, c + 1),
        isDark(r - 1, c) && !inFinder(r - 1, c), isDark(r + 1, c) && !inFinder(r + 1, c))
      const x0 = origin + c * cell, y0 = origin + r * cell
      cv.paint(x0, y0, x0 + cell, y0 + cell, (x, y) => shape((x - x0) / cell, (y - y0) / cell), gradient)
    }
  }

  // finder patterns: violet rounded ring + dark centre dot
  for (const [r, c] of [[0, 0], [0, n - 7], [n - 7, 0]]) {
    const x0 = origin + c * cell, y0 = origin + r * cell, s = cell * 7
    cv.paint(x0, y0, x0 + s, y0 + s,
      (x, y) => inRoundRect(x, y, x0, y0, s, s, cell * 2) && !inRoundRect(x, y, x0 + cell, y0 + cell, cell * 5, cell * 5, cell * 1.1),
      solid(VIOLET))
    const dx = x0 + s / 2, dy = y0 + s / 2, rad = cell * 1.5
    cv.paint(dx - rad, dy - rad, dx + rad, dy + rad, (x, y) => (x - dx) ** 2 + (y - dy) ** 2 <= rad * rad, solid(INK))
  }

  // the K mark, bilinearly resampled into the cleared centre
  if (logo) {
    const lx = mid - logoSize / 2, ly = mid - logoSize / 2
    const fit = Math.min(logoSize / logo.w, logoSize / logo.h)
    const dw = logo.w * fit, dh = logo.h * fit
    const ox = mid - dw / 2, oy = mid - dh / 2
    void lx; void ly
    const u = cv.u
    for (let j = Math.floor(oy * u); j < Math.ceil((oy + dh) * u); j++) {
      for (let i = Math.floor(ox * u); i < Math.ceil((ox + dw) * u); i++) {
        const sx = ((i + 0.5) / u - ox) / fit - 0.5, sy = ((j + 0.5) / u - oy) / fit - 0.5
        const x0 = Math.max(0, Math.min(logo.w - 1, Math.floor(sx))), y0 = Math.max(0, Math.min(logo.h - 1, Math.floor(sy)))
        const x1 = Math.min(logo.w - 1, x0 + 1), y1 = Math.min(logo.h - 1, y0 + 1)
        const fx = Math.min(1, Math.max(0, sx - x0)), fy = Math.min(1, Math.max(0, sy - y0))
        const px = (xx: number, yy: number, ch: number) => logo.rgba[(yy * logo.w + xx) * 4 + ch]
        const mix = (ch: number) =>
          (px(x0, y0, ch) * (1 - fx) + px(x1, y0, ch) * fx) * (1 - fy) + (px(x0, y1, ch) * (1 - fx) + px(x1, y1, ch) * fx) * fy
        cv.blend(i, j, mix(0), mix(1), mix(2), mix(3) / 255)
      }
    }
  }

  // downsample ss x ss (premultiplied) -> final size
  const size = CARD * scale
  const out = new Uint8Array(size * size * 4)
  const w = cv.w
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      let r = 0, g = 0, b = 0, a = 0
      for (let dj = 0; dj < ss; dj++) {
        for (let di = 0; di < ss; di++) {
          const o = ((j * ss + dj) * w + (i * ss + di)) * 4
          const pa = cv.px[o + 3]
          r += cv.px[o] * pa; g += cv.px[o + 1] * pa; b += cv.px[o + 2] * pa; a += pa
        }
      }
      const o = (j * size + i) * 4
      if (a > 0) { out[o] = r / a; out[o + 1] = g / a; out[o + 2] = b / a }
      out[o + 3] = a / (ss * ss)
    }
  }
  return { size, rgba: out }
}

// ───────────────────────── PNG encoding ─────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
const crc32 = (buf: Uint8Array) => {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const u32 = (n: number) => new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255])
function chunk(type: string, data: Uint8Array): Uint8Array {
  const body = new Uint8Array(4 + data.length)
  for (let i = 0; i < 4; i++) body[i] = type.charCodeAt(i)
  body.set(data, 4)
  const out = new Uint8Array(12 + data.length)
  out.set(u32(data.length), 0)
  out.set(body, 4)
  out.set(u32(crc32(body)), 8 + data.length)
  return out
}

export function encodePng(size: number, rgba: Uint8Array): Uint8Array {
  const raw = new Uint8Array(size * (size * 4 + 1)) // filter byte 0 + one RGBA row
  for (let y = 0; y < size; y++) raw.set(rgba.subarray(y * size * 4, (y + 1) * size * 4), y * (size * 4 + 1) + 1)
  const ihdr = new Uint8Array(13)
  ihdr.set(u32(size), 0); ihdr.set(u32(size), 4)
  ihdr[8] = 8; ihdr[9] = 6 // 8-bit RGBA
  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlibSync(raw, { level: 6 })),
    chunk('IEND', new Uint8Array(0)),
  ]
  const png = new Uint8Array(parts.reduce((s, p) => s + p.length, 0))
  let off = 0
  for (const p of parts) { png.set(p, off); off += p.length }
  return png
}

// ───────────────────────── logo + handler ─────────────────────────

let logoCache: Promise<Logo | null> | null = null
function loadLogo(): Promise<Logo | null> {
  logoCache ??= (async () => {
    try {
      const res = await fetch(LOGO_URL, { signal: AbortSignal.timeout(4000) })
      if (!res.ok) return null
      const img = decodePng(new Uint8Array(await res.arrayBuffer()))
      const { width: w, height: h, data, channels, depth } = img
      const rgba = new Uint8Array(w * h * 4)
      const shift = depth === 16 ? 8 : 0
      const get = (i: number) => (depth === 16 ? (data as Uint16Array)[i] >> shift : (data as Uint8Array)[i])
      for (let p = 0; p < w * h; p++) {
        const base = p * channels
        if (channels >= 3) {
          rgba[p * 4] = get(base); rgba[p * 4 + 1] = get(base + 1); rgba[p * 4 + 2] = get(base + 2)
          rgba[p * 4 + 3] = channels === 4 ? get(base + 3) : 255
        } else {
          rgba[p * 4] = rgba[p * 4 + 1] = rgba[p * 4 + 2] = get(base)
          rgba[p * 4 + 3] = channels === 2 ? get(base + 1) : 255
        }
      }
      return { w, h, rgba }
    } catch {
      logoCache = null // retry on the next request
      return null // still a scannable QR without the centre mark
    }
  })()
  return logoCache
}

// Real check-in tokens are exactly 32 hex characters; shorter data makes a QR so small that
// the centre mark would eat too much of it.
const TOKEN_RE = /^[A-Za-z0-9_-]{32,64}$/

export async function handle(req: Request): Promise<Response> {
  if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Method not allowed', { status: 405 })
  const token = new URL(req.url).searchParams.get('t') ?? ''
  if (!TOKEN_RE.test(token)) return new Response('Invalid token', { status: 400 })
  const { size, rgba } = renderPassQr(token, await loadLogo())
  return new Response(req.method === 'HEAD' ? null : encodePng(size, rgba), {
    headers: {
      'Content-Type': 'image/png',
      // A given token always renders the same image: let mail proxies and browsers keep it.
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}

// Deno.serve only exists in the edge runtime; the exports above are what the tests import.
// @ts-ignore Deno global
if (typeof Deno !== 'undefined' && Deno.serve) Deno.serve(handle)
