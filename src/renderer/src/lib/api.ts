import type {
  Paged,
  PlaybackState,
  PlaylistItemRow,
  PlaylistItemChild,
  QueueState,
  RecentlyPlayedRow,
  RepeatMode,
  SavedAlbumRow,
  SavedLibraryRow,
  SpotifyAlbum,
  SpotifyArtist,
  SpotifyDevice,
  SpotifyPlaylistDetail,
  SpotifyPlaylistSummary,
  SpotifyTrack,
  SpotifyUser
} from './types'

const API_BASE = 'https://api.spotify.com/v1'

export class SpotifyApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly reason?: string
  ) {
    super(message)
    this.name = 'SpotifyApiError'
  }
}

export function isPremiumRequiredError(err: unknown): boolean {
  if (!(err instanceof SpotifyApiError)) return false
  if (err.status !== 403) return false
  return err.reason === 'PREMIUM_REQUIRED' || /premium/i.test(err.message)
}

async function accessToken(): Promise<string> {
  // Throws AuthError('not-signed-in' | 'token-revoked') mapped from main.
  return window.attune.getAccessToken()
}

async function request<T>(
  path: string,
  options: {
    method?: string
    body?: unknown
    query?: Record<string, string | number | boolean | undefined>
    /** Retry once with a fresh token on 401 (covers expiry race). */
    allowAuthRetry?: boolean
    /** Retry once after Retry-Backoff on 429. */
    allowRateRetry?: boolean
    signal?: AbortSignal
  } = {}
): Promise<T> {
  const { method = 'GET', body, query, allowAuthRetry = true, allowRateRetry = true, signal } = options
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value))
    }
  }

  let token = await accessToken()
  const doFetch = async (bearer: string): Promise<Response> =>
    fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${bearer}`,
        ...(body !== undefined ? { 'content-type': 'application/json' } : {})
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal
    })

  let response = await doFetch(token)

  if (response.status === 401 && allowAuthRetry) {
    // The vault may have refreshed underneath us while the request was in flight.
    token = await accessToken()
    response = await doFetch(token)
  }

  if (response.status === 429 && allowRateRetry) {
    const wait = Math.min(Number(response.headers.get('retry-after') ?? '2') * 1000, 10_000)
    await new Promise((r) => setTimeout(r, wait))
    response = await doFetch(token)
  }

  if (response.status === 204) return undefined as T

  const text = response.status === 401 ? '' : await response.text()
  let payload: unknown = undefined
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = { error: { message: text.slice(0, 200) } }
    }
  }

  if (!response.ok) {
    const apiError = (payload as { error?: { message?: string; reason?: string } } | undefined)?.error
    if (response.status === 401) {
      const err = new Error('Session expired or invalid. Sign in again.') as Error & { code?: string }
      err.code = 'token-revoked'
      throw err
    }
    throw new SpotifyApiError(
      apiError?.message ?? `Request failed (HTTP ${response.status})`,
      response.status,
      apiError?.reason
    )
  }

  return (payload ?? (undefined as unknown)) as T
}

export const api = {
  me(): Promise<SpotifyUser> {
    return request<SpotifyUser>('/me')
  },

  // ---------- Library ----------
  playlists(offset = 0, limit = 30): Promise<Paged<SpotifyPlaylistSummary>> {
    return request('/me/playlists', { query: { limit, offset } })
  },
  playlist(id: string): Promise<SpotifyPlaylistDetail> {
    return request(`/playlists/${encodeURIComponent(id)}`, { query: { additional_types: 'track' } })
  },
  playlistItems(id: string, offset = 0, limit = 50): Promise<Paged<PlaylistItemRow>> {
    return request(`/playlists/${encodeURIComponent(id)}/items`, {
      query: { limit, offset, additional_types: 'track' }
    })
  },

  savedTracks(offset = 0, limit = 50): Promise<Paged<SavedLibraryRow>> {
    return request('/me/tracks', { query: { limit, offset } })
  },
  savedAlbums(offset = 0, limit = 30): Promise<Paged<SavedAlbumRow>> {
    return request('/me/albums', { query: { limit, offset } })
  },

  /** Feb 2026 consolidated library mutations. Returns true when the server confirmed. */
  async saveUris(uris: string[]): Promise<boolean> {
    await request('/me/library', { method: 'PUT', query: { uris: uris.join(',') } })
    return true
  },
  async removeUris(uris: string[]): Promise<boolean> {
    await request('/me/library', { method: 'DELETE', query: { uris: uris.join(',') } })
    return true
  },
  containsUris(uris: string[]): Promise<boolean[]> {
    return request('/me/library/contains', { query: { uris: uris.join(',') } })
  },

  // ---------- Catalog ----------
  album(id: string): Promise<SpotifyAlbum> {
    return request(`/albums/${encodeURIComponent(id)}`)
  },
  albumTracks(id: string, offset = 0, limit = 50): Promise<Paged<PlaylistItemChild>> {
    return request(`/albums/${encodeURIComponent(id)}/tracks`, { query: { limit, offset } })
  },
  artist(id: string): Promise<SpotifyArtist> {
    return request(`/artists/${encodeURIComponent(id)}`)
  },
  artistAlbums(id: string, offset = 0, limit = 30): Promise<Paged<SpotifyAlbum>> {
    return request(`/artists/${encodeURIComponent(id)}/albums`, {
      query: { include_groups: 'album,single', limit, offset }
    })
  },
  search(
    queryText: string,
    types: string,
    limit = 10,
    offset = 0
  ): Promise<{
    tracks: Paged<SpotifyTrack> | null
    albums: Paged<SpotifyAlbum> | null
    artists: Paged<SpotifyArtist> | null
    playlists: Paged<SpotifyPlaylistSummary> | null
  }> {
    const url = new URL(`${API_BASE}/search`)
    url.searchParams.set('q', queryText)
    url.searchParams.set('type', types)
    if (limit) url.searchParams.set('limit', String(limit))
    if (offset) url.searchParams.set('offset', String(offset))
    return request(url.pathname + url.search)
  },
  track(id: string): Promise<SpotifyTrack> {
    return request(`/tracks/${encodeURIComponent(id)}`)
  },

  // ---------- Personalization ----------
  topItems(type: 'tracks' | 'artists', timeRange: 'short_term' | 'medium_term' | 'long_term', offset = 0, limit = 20): Promise<Paged<SpotifyTrack | SpotifyArtist>> {
    return request(`/me/top/${type}`, { query: { time_range: timeRange, limit, offset } })
  },
  recentlyPlayed(): Promise<{ items: RecentlyPlayedRow[] }> {
    return request('/me/player/recently-played', { query: { limit: 50 } })
  },

  // ---------- Player ----------
  playerState(): Promise<PlaybackState> {
    return request<PlaybackState>('/me/player', { allowRateRetry: false })
  },
  currentlyPlaying(): Promise<PlaybackState> {
    return request<PlaybackState>('/me/player/currently-playing', { allowRateRetry: false })
  },
  devices(): Promise<{ devices: SpotifyDevice[] }> {
    return request('/me/player/devices')
  },
  play(
    deviceId: string | undefined,
    body: { context_uri?: string; uris?: string[]; offset?: { position?: number; uri?: string }; position_ms?: number } = {}
  ): Promise<void> {
    return request('/me/player/play', {
      method: 'PUT',
      query: deviceId ? { device_id: deviceId } : undefined,
      body: Object.keys(body).length ? body : undefined
    })
  },
  pause(deviceId?: string): Promise<void> {
    return request('/me/player/pause', { method: 'PUT', query: deviceId ? { device_id: deviceId } : undefined })
  },
  next(deviceId?: string): Promise<void> {
    return request('/me/player/next', { method: 'POST', query: deviceId ? { device_id: deviceId } : undefined })
  },
  previous(deviceId?: string): Promise<void> {
    return request('/me/player/previous', { method: 'POST', query: deviceId ? { device_id: deviceId } : undefined })
  },
  seek(positionMs: number, deviceId?: string): Promise<void> {
    return request('/me/player/seek', {
      method: 'PUT',
      query: { position_ms: Math.max(0, Math.floor(positionMs)), ...(deviceId ? { device_id: deviceId } : {}) }
    })
  },
  volume(percent: number, deviceId?: string): Promise<void> {
    return request('/me/player/volume', {
      method: 'PUT',
      query: { volume_percent: Math.round(percent), ...(deviceId ? { device_id: deviceId } : {}) }
    })
  },
  shuffle(state: boolean, deviceId?: string): Promise<void> {
    return request('/me/player/shuffle', {
      method: 'PUT',
      query: { state, ...(deviceId ? { device_id: deviceId } : {}) }
    })
  },
  repeat(mode: RepeatMode, deviceId?: string): Promise<void> {
    return request('/me/player/repeat', { method: 'PUT', query: { state: mode, ...(deviceId ? { device_id: deviceId } : {}) } })
  },
  queue(): Promise<QueueState> {
    return request('/me/player/queue')
  },
  addToQueue(uri: string, deviceId?: string): Promise<void> {
    return request('/me/player/queue', { method: 'POST', query: { uri, ...(deviceId ? { device_id: deviceId } : {}) } })
  },
  transfer(deviceIds: string[], play = false): Promise<void> {
    return request('/me/player', { method: 'PUT', body: { device_ids: deviceIds, play } })
  },

  /** Opens a catalog page in the system browser (share links unchanged). */
  async openInBrowser(url: string): Promise<void> {
    await window.attune.openExternal(url)
  }
}
