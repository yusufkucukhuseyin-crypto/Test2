import { ACCENTS, type AccentPreset } from '../db/defaults'
import type { Settings } from '../db/types'

type HSL = [number, number, number] // h 0-360, s 0-1, l 0-1

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)]
}

export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('')
}

export function rgbToHsl(r: number, g: number, b: number): HSL {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return [h * 60, s, l]
}

export function hslToHex(h: number, s: number, l: number): string {
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255)
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** Tek bir marka renginden okunaklı tema renkleri üretir (beyaz yazı okunur ana renk, açık zemin, koyu yazı) */
export function paletteFromHex(hex: string): AccentPreset {
  const [h, s, l] = rgbToHsl(...hexToRgb(hex))
  const sat = s < 0.08 ? s : clamp(s, 0.28, 0.6)
  return {
    key: 'ozel',
    label: 'Logodan',
    accent: hslToHex(h, sat, clamp(l, 0.36, 0.52)),
    soft: hslToHex(h, s < 0.08 ? 0.05 : clamp(s, 0.3, 0.55), 0.93),
    ink: hslToHex(h, s < 0.08 ? s : clamp(s, 0.3, 0.55), 0.28),
  }
}

/** Ayarlara göre kullanılacak tema renkleri */
export function resolveAccent(settings?: Pick<Settings, 'accent' | 'accentColor'>): AccentPreset {
  if (settings?.accent === 'ozel' && settings.accentColor) return paletteFromHex(settings.accentColor)
  return ACCENTS.find((x) => x.key === settings?.accent) ?? ACCENTS[0]
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image()
    img.onload = () => res(img)
    img.onerror = () => rej(new Error('Görsel okunamadı'))
    img.src = src
  })
}

/** Logoyu en fazla 512 px'e küçültüp şeffaflığı koruyarak PNG data URL'e çevirir */
export async function processLogo(file: Blob): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    const scale = Math.min(1, 512 / Math.max(img.naturalWidth || 512, img.naturalHeight || 512))
    const w = Math.max(1, Math.round((img.naturalWidth || 512) * scale))
    const h = Math.max(1, Math.round((img.naturalHeight || 512) * scale))
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    c.getContext('2d')!.drawImage(img, 0, 0, w, h)
    return c.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Logodaki baskın marka rengini bulur: şeffaf, beyaza ve siyaha çok yakın pikselleri atlar,
 * renk tonlarını doygunluğa göre ağırlıklandırır. Renkli piksel yoksa (siyah-beyaz logo) koyu ortalamayı döner.
 */
export async function dominantColor(dataUrl: string): Promise<string> {
  const img = await loadImage(dataUrl)
  const size = 64
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0, size, size)
  const px = ctx.getImageData(0, 0, size, size).data
  const buckets = new Map<number, { w: number; r: number; g: number; b: number }>()
  let dark = { n: 0, r: 0, g: 0, b: 0 }
  for (let i = 0; i < px.length; i += 4) {
    const [r, g, b, a] = [px[i], px[i + 1], px[i + 2], px[i + 3]]
    if (a < 128) continue
    const [h, s, l] = rgbToHsl(r, g, b)
    if (l > 0.94) continue
    if (s < 0.18 || l < 0.1 || l > 0.88) {
      if (l < 0.75) dark = { n: dark.n + 1, r: dark.r + r, g: dark.g + g, b: dark.b + b }
      continue
    }
    const key = Math.round(h / 12) % 30
    const wgt = s * (1 - Math.abs(l - 0.5))
    const cur = buckets.get(key) ?? { w: 0, r: 0, g: 0, b: 0 }
    buckets.set(key, { w: cur.w + wgt, r: cur.r + r * wgt, g: cur.g + g * wgt, b: cur.b + b * wgt })
  }
  const best = [...buckets.values()].sort((a, b) => b.w - a.w)[0]
  if (best && best.w > 2) return rgbToHex(best.r / best.w, best.g / best.w, best.b / best.w)
  if (dark.n) return rgbToHex(dark.r / dark.n, dark.g / dark.n, dark.b / dark.n)
  return ACCENTS[0].accent
}
