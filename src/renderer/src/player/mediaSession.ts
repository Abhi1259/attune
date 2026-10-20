/** OS media keys + now-playing integration through the browser MediaSession API.
 *  Electron/Chromium connects this to SMTC (Windows), MPRIS (Linux) and macOS
 *  media-key handling, so play/pause/skip from the keyboard "just work". */

import type { SpotifyTrack } from '../lib/types'

type Session = MediaSession | undefined

function session(): Session {
  if (!('mediaSession' in navigator)) {
    console.warn('[mediaSession] API unavailable on this build')
    return undefined
  }
  return navigator.mediaSession
}

interface Handlers {
  togglePlay(): void
  next(): void
  previous(): void
}

let bound = false

export function initMediaSession(handlers: Handlers): void {
  const ms = session()
  if (!ms || bound) return
  bound = true
  try {
    ms.setActionHandler('play', () => handlers.togglePlay())
    ms.setActionHandler('pause', () => handlers.togglePlay())
    ms.setActionHandler('nexttrack', () => handlers.next())
    ms.setActionHandler('previoustrack', () => handlers.previous())
  } catch (err) {
    console.warn('[mediaSession] action registration failed:', err)
  }
}

export function updateMediaSession(track: SpotifyTrack | null, isPlaying: boolean, artworkDataUrl: string | null): void {
  const ms = session()
  if (!ms) return
  try {
    if (!track) {
      ms.metadata = null
      ms.playbackState = 'none'
      return
    }
    ms.metadata = new MediaMetadata({
      title: track.name,
      artist: (track.artists ?? []).map((a) => a.name).join(', '),
      album: track.album?.name,
      artwork: artworkDataUrl ? [{ src: artworkDataUrl, sizes: '512x512', type: 'image/png' }] : []
    })
    ms.playbackState = isPlaying ? 'playing' : 'paused'
  } catch (err) {
    console.warn('[mediaSession] metadata update failed:', err)
  }
}
