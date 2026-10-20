export function formatDuration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return '—'
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function joinArtists(artists: { name: string }[] | undefined | null): string {
  if (!artists?.length) return 'Unknown artist'
  return artists.map((a) => a.name).join(', ')
}

export function relativePlayedAt(playedAt: string): string {
  const then = Date.parse(playedAt.endsWith('Z') ? playedAt : `${playedAt}Z`)
  if (Number.isNaN(then)) return ''
  const diffMs = Date.now() - then
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return new Date(then).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function timeGreeting(d = new Date()): 'Good morning' | 'Good afternoon' | 'Good evening' {
  const h = d.getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

export function contextLabel(uri: string | null | undefined, fallbackName?: string): string | undefined {
  if (fallbackName) return fallbackName
  if (!uri) return undefined
  if (uri.startsWith('spotify:playlist:')) return 'Playlist'
  if (uri.startsWith('spotify:album:')) return 'Album'
  if (uri.startsWith('spotify:artist:')) return 'Artist'
  return undefined
}
