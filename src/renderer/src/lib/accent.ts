/** Album-art dominant color sampler feeding the runtime accent (--att-accent).
 *  Runs on a small downscaled canvas — cheap enough for artwork swaps. */

const SAMPLE_SIZE = 48

export interface Accent {
  hex: string
  /** black (#101211) or white (#ffffff) depending on accent luminance */
  contrast: string
}

export async function extractAccent(imageUrl: string): Promise<Accent | null> {
  try {
    const img = new Image()
    img.decoding = 'async'
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('image decode failed'))
      img.src = imageUrl
    })
    const canvas = document.createElement('canvas')
    canvas.width = SAMPLE_SIZE
    canvas.height = SAMPLE_SIZE
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE)
    const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE)

    // Coarse 5-bit-per-channel histogram, weighted toward saturated midtone pixels.
    const buckets = new Map<number, { count: number; r: number; g: number; b: number }>()
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] ?? 0
      const g = data[i + 1] ?? 0
      const b = data[i + 2] ?? 0
      const a = data[i + 3] ?? 0
      if (a < 16) continue
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      const sat = max === 0 ? 0 : (max - min) / max
      const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
      // Ignore near-black/near-white/gray extremes: they make weak accents.
      const weight = 0.25 + sat * (lum > 0.08 && lum < 0.92 ? 1 : 0.1)
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
      const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 }
      bucket.count += weight
      bucket.r += r * weight
      bucket.g += g * weight
      bucket.b += b * weight
      buckets.set(key, bucket)
    }
    let best: { count: number; r: number; g: number; b: number } | null = null
    for (const bucket of buckets.values()) {
      if (!best || bucket.count > best.count) best = bucket
    }
    if (!best || best.count < 8) return null

    // Slightly deepen toward a usable UI accent (jump over muddy midtones).
    let r = best.r / best.count
    let g = best.g / best.count
    let b = best.b / best.count
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
    if (lum < 0.22) {
      const lift = 0.22 / Math.max(lum, 1e-3)
      r = Math.min(255, r * lift)
      g = Math.min(255, g * lift)
      b = Math.min(255, b * lift)
    } else if (lum > 0.68) {
      const drop = 0.68 / Math.max(lum, 1e-3)
      r *= drop
      g *= drop
      b *= drop
    }
    const toHex = (v: number) => Math.round(v).toString(16).padStart(2, '0')
    const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`
    const newLum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
    return { hex, contrast: newLum > 0.55 ? '#101211' : '#ffffff' }
  } catch {
    return null
  }
}
