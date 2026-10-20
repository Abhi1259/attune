/** Hand-typed subset of the Spotify Web API models Attune consumes.
 *  Field shapes follow the Feb/Mar 2026 Web API (no `available_markets`,
 *  no `popularity`, playlist item containers renamed `tracks`→`items`,
 *  `PlaylistItem.track`→`item`). Defensive readers absorb server variance. */

export interface SpotifyImage {
  url: string
  width: number | null
  height: number | null
}

export interface SpotifyArtist {
  id: string
  name: string
  uri?: string
  images?: SpotifyImage[]
  genres?: string[]
}

export interface SpotifyAlbum {
  id: string
  uri: string
  name: string
  images: SpotifyImage[]
  album_type?: 'album' | 'single' | 'compilation'
  artists: SpotifyArtist[]
  release_date?: string
  total_tracks?: number
  album_group?: string // may still appear on legacy payloads; treated as optional
}

/** A track object in any of the shapes the API returns (full or simplified). */
export interface SpotifyTrack {
  id: string
  name: string
  uri: string
  duration_ms: number
  explicit?: boolean
  is_playable?: boolean
  is_local?: boolean
  artists?: SpotifyArtist[]
  album?: SpotifyAlbum & { id: string | null }
  played_at?: string
  added_at?: string
}

export interface SpotifyUser {
  id: string
  display_name?: string
  images?: SpotifyImage[]
}

export interface SpotifyPlaylistSummary {
  id: string
  uri: string
  name: string
  images: SpotifyImage[]
  owner?: SpotifyUser
  /** Feb 2026: renamed from `tracks`; only present for the current user's own playlists. */
  items?: { total: number; href: string | null } | null
  tracks?: { total: number } | null // legacy shape tolerated
  collaborative?: boolean
  public?: boolean
}

export interface SpotifyPlaylistDetail extends SpotifyPlaylistSummary {
  description?: string
  followers?: { total: number }
}

export interface SpotifyDevice {
  id: string
  name: string
  type: string
  is_active: boolean
  volume_percent?: number
  is_restricted?: boolean
}

export type RepeatMode = 'off' | 'track' | 'context'

export interface PlaybackState {
  device: SpotifyDevice | null
  shuffle_state: boolean
  repeat_state: RepeatMode
  is_playing: boolean
  progress_ms: number | null
  item: SpotifyTrack | null
  context?: { uri: string | null; type: string | null } | null
}

export interface QueueState {
  currently_playing: SpotifyTrack | null
  queue: SpotifyTrack[]
}

export interface Paged<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}

export interface PlaylistItemRow {
  item?: SpotifyTrack | null // Feb 2026 shape
  track?: SpotifyTrack | null // legacy shape tolerated
  added_at?: string
}

export interface SavedLibraryRow {
  added_at?: string
  item?: SpotifyTrack | null
  track?: SpotifyTrack | null
  album?: SpotifyAlbum | null
}

/** Album track list rows are bare (simplified) track objects, no item wrapper. */
export type PlaylistItemChild = SpotifyTrack

export interface SavedAlbumRow {
  added_at?: string
  album: SpotifyAlbum
}

export interface RecentlyPlayedRow {
  track: SpotifyTrack
  played_at: string
}

/** Track objects arrive in several shapes; playlists use `item`, library lists may use either. */
export function readTrackRow(row: PlaylistItemRow | SavedLibraryRow | { item?: SpotifyTrack | null; track?: SpotifyTrack | null }): SpotifyTrack | null {
  return row.item ?? row.track ?? null
}

export function pickImage(images: SpotifyImage[] | undefined, minWidth = 300): string | null {
  if (!images?.length) return null
  const sorted = [...images].sort((a, b) => (a.width ?? 0) - (b.width ?? 0))
  return (sorted.find((img) => (img.width ?? 640) >= minWidth) ?? sorted[sorted.length - 1])?.url ?? null
}
