import { api, isPremiumRequiredError, SpotifyApiError } from '../lib/api'
import { getArtwork } from '../lib/artworkCache'
import { devicePreference, liveProgress, usePlayer, type Snapshot } from './store'
import { currentSdkPlayer, disconnectSdkPlayer, ensureSdkPlayer, mapWebState, widevineSupported } from './wps'
import { initMediaSession, updateMediaSession } from './mediaSession'
import { useAuthStore } from '../stores/authStore'
import { useSettingsStore } from '../stores/settingsStore'

const STATE_POLL_MS = 3000
const DEVICES_POLL_MS = 15000

interface PlayRequest {
  contextUri?: string
  uris?: string[]
  offset?: { position?: number; uri?: string }
  positionMs?: number
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** Orchestration singleton: marshals Web API + SDK state into one coherent player. */
class PlayerEngine {
  private started = false
  private authFailures = 0
  private serverPending = false
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private devicesTimer: ReturnType<typeof setInterval> | null = null
  private trayTimer: ReturnType<typeof setTimeout> | null = null

  init(): void {
    if (this.started) return
    this.started = true

    initMediaSession({
      togglePlay: () => this.togglePlay(),
      next: () => this.next(),
      previous: () => this.previous()
    })
    window.attune.onTrayAction((action) => {
      if (action === 'togglePlay') this.togglePlay()
      else if (action === 'next') this.next()
      else if (action === 'prev') this.previous()
      // 'quit' is handled by main directly.
    })

    void this.boot()
  }

  private async boot(): Promise<void> {
    // A signed check precedes everything: without valid auth (or client id), the
    // auth gate renders and polling stays dormant until login completes.
    const authPhase = useAuthStore.getState().phase
    if (authPhase !== 'signed-in') {
      // Login flow notifies us through startPollingAfterLogin().
      return
    }
    await this.startPollingAfterLogin()
  }

  /** Called after an OAuth session becomes available (login or app restart). */
  async startPollingAfterLogin(): Promise<void> {
    await Promise.resolve().then(() => undefined)
    const settings = useSettingsStore.getState().settings
    if (settings?.inAppStreaming) void this.checkWidevineAndConnectSdk()
    else usePlayer.getState().setInApp({ status: 'off' })

    if (!this.pollTimer) {
      this.pollTimer = setInterval(() => void this.refreshState(), STATE_POLL_MS)
      this.devicesTimer = setInterval(() => void this.refreshDevices(), DEVICES_POLL_MS)
    }
    await Promise.all([this.refreshDevices(), this.refreshState()])
  }

  stopPolling(): void {
    disconnectSdkPlayer()
    if (this.pollTimer) clearInterval(this.pollTimer)
    if (this.devicesTimer) clearInterval(this.devicesTimer)
    this.pollTimer = null
    this.devicesTimer = null
    usePlayer.getState().setSnapshot(null)
    usePlayer.getState().setIdle(true)
    usePlayer.getState().setInApp({ id: null, status: 'off' })
  }

  private async checkWidevineAndConnectSdk(): Promise<void> {
    const store = usePlayer.getState()
    const supported = await widevineSupported()
    if (!supported) {
      store.setInApp({
        status: 'error',
        widevine: false,
        error: 'This Electron build has no Widevine module, so full-track streaming is unavailable. Remote control of your other devices still works. To enable in-app playback, run `npm run electron:fetch` to install the castlabs build.'
      })
      return
    }
    store.setInApp({ widevine: true, status: 'connecting' })
    const deviceName = useSettingsStore.getState().settings?.deviceName ?? 'Attune'
    try {
      await ensureSdkPlayer({
        deviceName,
        initialVolume: usePlayer.getState().volume,
        getToken: async () => {
          useAuthStore.getState().touch()
          return window.attune.getAccessToken()
        },
        onDeviceReady: (deviceId) => {
          usePlayer.getState().setInApp({ id: deviceId, status: 'ready' })
          void this.refreshDevices()
          void this.refreshState()
        },
        onDeviceUnavailable: () => {
          usePlayer.getState().setInApp({ status: 'error', error: 'Player went offline in Spotify Connect.' })
        },
        onStateChanged: (snapshot: Snapshot) => {
          this.applyWpsSnapshot(snapshot)
        },
        onError: (kind, message) => {
          const store = usePlayer.getState()
          if (kind === 'account') {
            // Free account connecting the SDK: Spotify refuses it outright.
            store.setInApp({
              status: 'error',
              widevine: true,
              error: 'Spotify Premium is required for in-app streaming.'
            })
            store.setPremiumBlocked(true, 'Spotify Premium is required for in-app streaming. Browsing and the embed player still work on free accounts.')
          } else if (kind === 'authentication') {
            store.setInApp({ status: 'error', widevine: true, error: `Sign-in issue: ${message}` })
          } else if (kind === 'initialization') {
            store.setInApp({ status: 'error', widevine: false, error: message })
          } else {
            store.setLastError(`Playback error: ${message}`)
          }
        }
      })
    } catch (err) {
      usePlayer.getState().setInApp({
        status: 'error',
        widevine: true,
        error: err instanceof Error ? err.message : 'Failed to start in-app player.'
      })
    }
  }

  // ------------------------------------------------------------------ state

  private applyWpsSnapshot(snapshot: Snapshot): void {
    const store = usePlayer.getState()
    const previous = store.snapshot
    if (snapshot.track === null && (previous?.source === 'server' || !previous)) {
      // SDK reported null right after another device took over; server poll decides.
      return
    }
    store.setIdle(false)
    store.setSnapshot(snapshot)
    if (store.activeDeviceId !== snapshot.deviceId) store.setActiveDevice(snapshot.deviceId)
    if (previous && snapshot.track && previous.track?.uri !== snapshot.track.uri) void this.loadQueue()
  }

  private serverToSnapshot(state: {
    device: { id: string; name: string; type: string; is_active: boolean; volume_percent?: number } | null
    is_playing: boolean
    progress_ms: number | null
    shuffle_state: boolean
    repeat_state: 'off' | 'track' | 'context'
    item: {
      id: string
      uri: string
      name: string
      duration_ms: number
      artists?: { id?: string; name: string; uri?: string }[]
      album?: { id?: string | null; uri?: string; name?: string; images?: { url: string; width?: number | null }[] }
    } | null
    context?: { uri?: string | null; type?: string | null } | null
  }): Snapshot {
    const item = state.item
    const wpsActive = usePlayer.getState().inApp.id
    return {
      track: item
        ? {
            id: item.id,
            uri: item.uri,
            name: item.name,
            duration_ms: item.duration_ms,
            artists: (item.artists ?? []).map((a) => ({ id: a.id ?? '', name: a.name, uri: a.uri })),
            album: item.album
              ? {
                  id: item.album.id ?? '',
                  uri: item.album.uri ?? '',
                  name: item.album.name ?? '',
                  images: (item.album.images ?? []).map((i) => ({ url: i.url, width: i.width ?? null, height: null })),
                  artists: []
                }
              : undefined
          }
        : null,
      contextUri: state.context?.uri ?? null,
      isPlaying: state.is_playing,
      progressMs: state.progress_ms,
      durationMs: item?.duration_ms ?? 0,
      updatedAt: Date.now(),
      shuffle: state.shuffle_state,
      repeat: state.repeat_state,
      source: state.device?.id && wpsActive && state.device.id === wpsActive ? 'wps' : 'server',
      deviceId: state.device?.id ?? null
    }
  }

  async refreshState(): Promise<void> {
    if (this.serverPending) return
    const tokenReady = useAuthStore.getState().phase === 'signed-in'
    if (!tokenReady) return
    this.serverPending = true
    try {
      const state = await api.currentlyPlaying()
      const store = usePlayer.getState()
      if (!state) {
        // Nothing playing anywhere we can see.
        const inAppActive = store.inApp.status === 'ready' && !!store.inApp.id
        if (!inAppActive || !store.snapshot?.isPlaying) {
          store.setSnapshot(null)
          store.setIdle(true)
        }
        this.authFailures = 0
        return
      }
      store.setIdle(false)
      const snapshot = this.serverToSnapshot(state)
      // Prefer fresher WPS events for the SDK's own device (they include queue-ahead detail).
      const prev = store.snapshot
      const sameSdkTrack =
        prev?.source === 'wps' &&
        snapshot.source === 'wps' &&
        prev.track?.uri === snapshot.track?.uri &&
        prev.isPlaying === snapshot.isPlaying
      if (!sameSdkTrack || !prev) {
        store.setSnapshot(snapshot)
        if (prev?.track?.uri !== snapshot.track?.uri) void this.loadQueue()
      }
      if (typeof state.device?.volume_percent === 'number' && snapshot.source === 'server') {
        store.setVolume(Math.round(state.device.volume_percent))
      }
      store.setActiveDevice(snapshot.deviceId ?? store.activeDeviceId)
      this.authFailures = 0
      this.pushTrayState()
    } catch (err) {
      this.handleApiError(err, 'polling playback state')
    } finally {
      this.serverPending = false
    }
  }

  async refreshDevices(): Promise<void> {
    if (useAuthStore.getState().phase !== 'signed-in') return
    try {
      const { devices: remote } = await api.devices()
      const store = usePlayer.getState()
      const inApp = store.inApp
      const listed: typeof remote = remote.filter((d) => Boolean(d.id))
      if (inApp.status === 'ready' && inApp.id) {
        listed.unshift({
          id: inApp.id,
          name: `${useSettingsStore.getState().settings?.deviceName ?? 'Attune'} (in-app)`,
          type: 'Computer',
          is_active: store.activeDeviceId === inApp.id
        })
      }
      store.setDevices(listed)
    } catch (err) {
      this.handleApiError(err, 'fetching devices')
    }
  }

  async loadQueue(): Promise<void> {
    if (useAuthStore.getState().phase !== 'signed-in') return
    try {
      const q = await api.queue()
      usePlayer.getState().setQueue(q.queue ?? [])
    } catch (err) {
      if (!(err instanceof SpotifyApiError && err.status === 404)) {
        this.handleApiError(err, 'loading queue')
      }
    }
  }

  // ----------------------------------------------------------------- errors

  private handleApiError(err: unknown, context: string): void {
    if (err instanceof SpotifyApiError) {
      if (isPremiumRequiredError(err)) {
        usePlayer.getState().setPremiumBlocked(true, err.message)
        return
      }
      usePlayer.getState().setLastError(`${context}: ${err.message}`)
      return
    }
    const code = (err as { code?: string } | null)?.code
    if (code === 'not-signed-in' || code === 'token-revoked') {
      this.authFailures += 1
      useAuthStore.getState().markSignedOut(code === 'token-revoked' ? 'revoked' : 'signed-out')
      this.stopPolling()
      return
    }
    console.warn(`[player] ${context} failed:`, err)
    usePlayer.getState().setLastError(context)
  }

  // -------------------------------------------------------------- transport

  private targetDeviceId(): string | undefined {
    return devicePreference(usePlayer.getState())
  }

  /** Runs a transport command; when Spotify reports no device, borrows the first available one. */
  private async withFallbackDevice(run: (deviceId?: string) => Promise<void>): Promise<void> {
    const preferred = this.targetDeviceId()
    try {
      await run(preferred)
    } catch (err) {
      const recoverable =
        err instanceof SpotifyApiError &&
        (err.status === 404 || /no active|device not found/i.test(err.message))
      if (!recoverable) throw err
      const store = usePlayer.getState()
      const fallback = preferred ?? store.devices.find((d) => !d.is_restricted)?.id
      if (!fallback) {
        store.setLastError('No Spotify device is available yet. Open Spotify on a device first.')
        return
      }
      await api.transfer([fallback], false)
      await delay(600)
      await run(fallback)
    }
  }

  private isLocalSdkTarget(): boolean {
    const store = usePlayer.getState()
    const target = this.targetDeviceId()
    return Boolean(target && store.inApp.status === 'ready' && target === store.inApp.id && currentSdkPlayer())
  }

  async togglePlay(): Promise<void> {
    const store = usePlayer.getState()
    try {
      const ws = currentSdkPlayer()
      if (this.isLocalSdkTarget() && ws) {
        await ws.togglePlay()
      } else {
        const isPlaying = store.snapshot?.isPlaying ?? false
        if (isPlaying) await this.withFallbackDevice((id) => api.pause(id))
        else await this.withFallbackDevice((id) => api.play(id))
      }
      await this.refreshState()
    } catch (err) {
      this.handleApiError(err, 'playback')
    }
  }

  async play(request: PlayRequest): Promise<void> {
    try {
      if (this.isLocalSdkTarget() && request.contextUri) {
        // Small delay avoids a race where the SDK buffer isn't ready for direct remote start.
        await delay(150)
      }
      await this.withFallbackDevice((id) =>
        api.play(id, {
          context_uri: request.contextUri,
          uris: request.uris,
          offset: request.offset,
          position_ms: request.positionMs
        })
      )
      usePlayer.getState().setPremiumBlocked(false, null)
      await this.refreshState()
    } catch (err) {
      this.handleApiError(err, 'playback')
    }
  }

  async next(): Promise<void> {
    try {
      await this.withFallbackDevice((id) => api.next(id))
      await delay(250)
      await this.refreshState()
    } catch (err) {
      this.handleApiError(err, 'skip')
    }
  }

  async previous(): Promise<void> {
    try {
      // Spotify's "previous" only rewinds when >3s into the track; honor the convention.
      const snap = usePlayer.getState().snapshot
      if (liveProgress(snap) > 3000 && snap) {
        await this.withFallbackDevice((id) => api.seek(0, id))
        await this.refreshState()
        return
      }
      await this.withFallbackDevice((id) => api.previous(id))
      await delay(250)
      await this.refreshState()
    } catch (err) {
      this.handleApiError(err, 'previous track')
    }
  }

  async seek(ms: number): Promise<void> {
    try {
      if (this.isLocalSdkTarget()) {
        await currentSdkPlayer()?.seek(Math.round(ms / 1000))
      }
      await this.withFallbackDevice((id) => api.seek(Math.round(ms), id))
      const snap = usePlayer.getState().snapshot
      if (snap) {
        usePlayer.getState().setSnapshot({ ...snap, progressMs: Math.round(ms), updatedAt: Date.now() })
      }
    } catch (err) {
      this.handleApiError(err, 'seek')
    }
  }

  async setVolume(percent: number): Promise<void> {
    const clamped = Math.max(0, Math.min(100, Math.round(percent)))
    usePlayer.getState().setVolume(clamped)
    try {
      if (this.isLocalSdkTarget()) {
        await currentSdkPlayer()?.setVolume(clamped / 100)
      }
      await this.withFallbackDevice((id) => api.volume(clamped, id))
    } catch (err) {
      this.handleApiError(err, 'volume')
    }
  }

  async setShuffle(enabled: boolean): Promise<void> {
    const previous = usePlayer.getState().snapshot
    const snap = usePlayer.getState().snapshot
    if (snap) usePlayer.getState().setSnapshot({ ...snap, shuffle: enabled })
    try {
      await this.withFallbackDevice((id) => api.shuffle(enabled, id))
    } catch (err) {
      if (previous) usePlayer.getState().setSnapshot(previous)
      usePlayer.getState().setLastError(err instanceof Error ? err.message : 'Could not toggle shuffle')
    }
  }

  async setRepeat(mode: 'off' | 'track' | 'context'): Promise<void> {
    const previous = usePlayer.getState().snapshot
    const snap = usePlayer.getState().snapshot
    if (snap) usePlayer.getState().setSnapshot({ ...snap, repeat: mode })
    try {
      await this.withFallbackDevice((id) => api.repeat(mode, id))
    } catch (err) {
      if (previous) usePlayer.getState().setSnapshot(previous)
      usePlayer.getState().setLastError(err instanceof Error ? err.message : 'Could not set repeat')
    }
  }

  async transferTo(deviceId: string, play = true): Promise<void> {
    try {
      usePlayer.getState().setActiveDevice(deviceId)
      await api.transfer([deviceId], play)
      await delay(500)
      await this.refreshDevices()
      await this.refreshState()
    } catch (err) {
      this.handleApiError(err, 'transfer playback')
    }
  }

  async addToQueue(uri: string): Promise<void> {
    try {
      await this.withFallbackDevice((id) => api.addToQueue(uri, id))
      if (usePlayer.getState().queue !== null) await this.loadQueue()
    } catch (err) {
      this.handleApiError(err, 'add to queue')
    }
  }

  /** Re-evaluates the in-app streaming setting (called from Settings on toggle). */
  async applyStreamingSetting(): Promise<void> {
    const settings = useSettingsStore.getState().settings
    if (!settings?.inAppStreaming) {
      disconnectSdkPlayer()
      usePlayer.getState().setInApp({ id: null, status: 'off' })
      await this.refreshDevices()
      return
    }
    await this.checkWidevineAndConnectSdk()
    await this.refreshDevices()
  }

  // ------------------------------------------------------------------ tray

  private pushTrayState(): void {
    if (this.trayTimer) clearTimeout(this.trayTimer)
    this.trayTimer = setTimeout(() => {
      const snap = usePlayer.getState().snapshot
      void window.attune.trayState({
        isPlaying: Boolean(snap?.isPlaying),
        title: snap?.track?.name ?? '',
        artists: (snap?.track?.artists ?? []).map((a) => a.name).join(', ')
      })
      const art = snap?.track?.album?.images?.[0]?.url
      if (art) {
        void getArtwork(art).then((dataUrl) => updateMediaSession(snap?.track ?? null, Boolean(snap?.isPlaying), dataUrl))
      } else {
        updateMediaSession(snap?.track ?? null, Boolean(snap?.isPlaying), null)
      }
    }, 350)
  }
}

export const playerEngine = new PlayerEngine()
