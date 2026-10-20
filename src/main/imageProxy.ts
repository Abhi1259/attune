/** Album-art proxy: fetches https artwork in the main process and returns data URLs.
 *  Keeps the renderer free of cross-origin image fetches and gives the accent
 *  sampler clean pixel access (data URLs don't taint canvases). */

const MAX_BYTES = 12 * 1024 * 1024
const TIMEOUT_MS = 10_000
const CACHE_TTL_MS = 60 * 60 * 1000

const cache = new Map<string, { dataUrl: string; at: number }>()

export async function fetchAsDataUrl(url: string): Promise<string> {
  const hit = cache.get(url)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.dataUrl

  const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!response.ok) throw new Error(`Artwork fetch failed: HTTP ${response.status}`)
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.startsWith('image/')) throw new Error(`Not an image (content-type: ${contentType})`)

  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.byteLength > MAX_BYTES) throw new Error('Artwork too large')
  if (buffer.byteLength === 0) throw new Error('Empty artwork response')

  const dataUrl = `data:${contentType};base64,${buffer.toString('base64')}`

  // Simple bounded cache.
  if (cache.size > 64) {
    for (const [key, value] of cache) {
      if (Date.now() - value.at > CACHE_TTL_MS) cache.delete(key)
      if (cache.size <= 64) break
    }
  }
  cache.set(url, { dataUrl, at: Date.now() })
  return dataUrl
}
