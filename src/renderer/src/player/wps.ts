/** Spotify Web Playback SDK integration.
 *  Requires the castlabs Electron build (Widevine CDM) for full-track playback,
 *  and a Premium account (Spotify-side restriction; is surfaced as a UI state). */

import type { Snapshot } from './store'
import type { RepeatMode, SpotifyTrack } from '../lib/types'

export type WpsErrorKind = 'initialization' | 'authentication' | 'account' | 'playback'

export interface WpsCallbacks {
  onDeviceReady: (deviceId: string) => void
  onDeviceUnavailable: () => void
  onStateChanged: (snapshot: Snapshot) => void
  onError: (kind: WpsErrorKind, message: string) => void
  getToken: () => Promise<string>
  deviceName: string
  initialVolume: number
}

/** Ambient, minimal typing for the SDK surface we use. */
declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void
    Spotify?: { Player: new (options: SpotifyPlayerOptions) => SpotifyPlayer }
  }
}

export interface SpotifyPlayerOptions {
  name: string
  getOAuthToken: (cb: (token: string) => void) => void
  volume?: number
  enableMediaSession?: boolean
}

export interface SpotifyPlayer {
  connect(): Promise<boolean>
  disconnect(): void
  addListener(event: 'ready' | 'not_ready', cb: ({ device_id }: { device_id: string }) => void): void
  addListener(event: 'player_state_changed', cb: (state: SpotifyWebPlaybackState | null) => void): void
  addListener(event: 'initialization_error' | 'authentication_error' | 'account_error' | 'playback_error', cb: (err: { message: string }) => void): void
  setVolume(volume: number): Promise<void>
  seek(positionSeconds: number): Promise<void>
  togglePlay(): Promise<void>
  pause(): Promise<void>
  getCurrentState(): Promise<SpotifyWebPlaybackState | null>
}

export interface SpotifyWebPlaybackTrack {
  id: string
  uri: string
  name: string
  duration_ms: number
  artists: { id?: string; uri?: string; name: string }[]
  album: { uri?: string; name: string; image_url?: string; images?: { url: string }[] }
}

export interface SpotifyWebPlaybackState {
  context?: { uri?: string } | null
  paused: boolean
  position: number
  duration: number
  shuffle: boolean
  repeat_mode: 0 | 1 | 2
  track_window: {
    current_track: SpotifyWebPlaybackTrack
    next_tracks: SpotifyWebPlaybackTrack[]
    previous_tracks: SpotifyWebPlaybackTrack[]
  }
}

export function uriToId(uri: string | undefined | null): string | null {
  if (!uri) return null
  const parts = uri.split(':')
  return parts.length >= 3 ? parts[parts.length - 1] ?? null : null
}

function webTrackToTrack(t: SpotifyWebPlaybackTrack): SpotifyTrack {
  return {
    id: t.id,
    uri: t.uri,
    name: t.name,
    duration_ms: t.duration_ms,
    artists: (t.artists ?? []).map((a) => ({ id: a.id ?? uriToId(a.uri) ?? '', name: a.name, uri: a.uri })),
    album: {
      id: uriToId(t.album?.uri) ?? '',
      uri: t.album?.uri ?? '',
      name: t.album?.name ?? '',
      images: t.album?.image_url
        ? [{ url: t.album.image_url, width: 640, height: 640 }]
        : (t.album?.images ?? []).map((i) => ({ url: i.url, width: null, height: null })),
      artists: []
    }
  }
}

export function mapWebState(state: SpotifyWebPlaybackState, deviceId: string): Snapshot {
  return {
    track: webTrackToTrack(state.track_window.current_track),
    contextUri: state.context?.uri ?? null,
    isPlaying: !state.paused,
    progressMs: state.position,
    durationMs: state.duration,
    updatedAt: Date.now(),
    shuffle: state.shuffle,
    repeat: (state.repeat_mode === 2 ? 'track' : state.repeat_mode === 1 ? 'context' : 'off') as RepeatMode,
    source: 'wps',
    deviceId
  }
}

/** Widevine availability check (EME + CDM present). */
export async function widevineSupported(): Promise<boolean> {
  if (!navigator.requestMediaKeySystemAccess) return false
  try {
    const access = await navigator.requestMediaKeySystemAccess('com.widevine.alpha', [
      {
        initDataTypes: ['cenc', 'keyids'],
        audioCapabilities: [{ contentType: 'audio/mp4; codecs="mp4a.40.2"', robustness: '' }]
      }
    ])
    return Boolean(access) && access.keySystem === 'com.widevine.alpha'
  } catch {
    return false
  }
}

let loadPromise: Promise<void> | null = null

function loadSdkScript(): Promise<void> {
  if (window.Spotify?.Player) return Promise.resolve()
  if (loadPromise) return loadPromise
  loadPromise = new Promise((resolve, reject) => {
    if (window.onSpotifyWebPlaybackSDKReady) return resolve()
    window.onSpotifyWebPlaybackSDKReady = () => resolve()
    const script = document.createElement('script')
    script.src = 'https://sdk.scdn.co/spotify-player.js'
    script.async = true
    script.onerror = () => reject(new Error('Failed to load the Spotify Web Playback SDK script.'))
    document.head.appendChild(script)
  })
  return loadPromise
}

let playerInstance: SpotifyPlayer | null = null

export function currentSdkPlayer(): SpotifyPlayer | null {
  return playerInstance
}

export async function ensureSdkPlayer(callbacks: WpsCallbacks): Promise<SpotifyPlayer> {
  if (playerInstance) return playerInstance
  await loadSdkScript()
  const Player = window.Spotify?.Player
  if (!Player) throw new Error('Spotify Web Playback SDK unavailable.')

  // The SDK requires OAuth token injection before EME license requests.
  const player = new Player({
    name: callbacks.deviceName,
    volume: Math.min(1, Math.max(0, callbacks.initialVolume / 100)),
    async getOAuthToken(cb) {
      try {
        const token = await callbacks.getToken()
        cb(token)
      } catch (err) {
        console.warn('[wps] token retrieval failed:', err)
      }
    }
  })
  playerInstance = player

  let readyDeviceId = ''
  player.addListener('ready', ({ device_id }) => {
    readyDeviceId = device_id
    callbacks.onDeviceReady(device_id)
  })
  player.addListener('not_ready', () => {
    callbacks.onDeviceUnavailable()
  })
  player.addListener('player_state_changed', (state) => {
    if (!state) {
      // Transitioned to another device; engine reconciles via server polling.
      callbacks.onStateChanged({
        track: null,
        contextUri: null,
        isPlaying: false,
        progressMs: null,
        durationMs: 0,
        updatedAt: Date.now(),
        shuffle: false,
        repeat: 'off',
        source: 'wps',
        deviceId: readyDeviceId
      })
      return
    }
    callbacks.onStateChanged(mapWebState(state, readyDeviceId))
  })
  player.addListener('initialization_error', ({ message }) => callbacks.onError('initialization', message))
  player.addListener('authentication_error', ({ message }) => callbacks.onError('authentication', message))
  player.addListener('account_error', ({ message }) => callbacks.onError('account', message))
  player.addListener('playback_error', ({ message }) => callbacks.onError('playback', message))

  const connected = await player.connect()
  if (!connected) throw new Error('Could not connect to Spotify Connect.')
  return player
}

export function disconnectSdkPlayer(): void {
  if (!playerInstance) return
  try {
    playerInstance.disconnect()
  } catch { /* noop */ }
  playerInstance = null
}
