import { extractAccent } from './accent'
import { getArtwork } from './artworkCache'

/** Pushes the album-art-derived accent into CSS variables on <html>.
 *  No-ops when the feature is off or no artwork is available. */

let lastUrl: string | null = null
let inflight: Promise<void> | null = null

export async function applyArtAccent(artUrl: string | null | undefined, enabled: boolean): Promise<void> {
  const root = document.documentElement
  if (!enabled || !artUrl) {
    lastUrl = null
    root.style.removeProperty('--att-accent')
    root.style.removeProperty('--att-accent-ink')
    if (inflight) {
      await inflight.catch(() => undefined)
      inflight = null
    }
    return
  }
  if (lastUrl === artUrl) return
  lastUrl = artUrl

  const run = (async () => {
    const dataUrl = await getArtwork(artUrl)
    if (lastUrl !== artUrl) return
    if (!dataUrl) {
      root.style.removeProperty('--att-accent')
      root.style.removeProperty('--att-accent-ink')
      return
    }
    const accent = await extractAccent(dataUrl)
    if (lastUrl !== artUrl) return
    if (accent) {
      root.style.setProperty('--att-accent', accent.hex)
      root.style.setProperty('--att-accent-ink', accent.contrast)
    } else {
      root.style.removeProperty('--att-accent')
      root.style.removeProperty('--att-accent-ink')
    }
  })()

  inflight = run
  await run
  inflight = null
}
