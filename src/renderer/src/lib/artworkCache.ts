/** Artwork fetch pipeline: Spotify CDN URLs → main-process proxy → cached data URLs.
 *  Data URLs tint-canvases cleanly for accent sampling and never trigger CORS. */

const memo = new Map<string, Promise<string>>()

export function getArtwork(url: string): Promise<string | null> {
  let cached = memo.get(url)
  if (cached) return cached.catch(() => Promise.resolve(null))
  cached = window.attune.artwork(url)
  memo.set(url, cached)
  if (memo.size > 96) {
    const oldest = memo.keys().next()
    if (!oldest.done && memo.size > 96) memo.delete(oldest.value)
  }
  return cached.catch((err) => {
    console.warn('[artwork] failed for', url, err)
    return Promise.resolve(null)
  })
}
