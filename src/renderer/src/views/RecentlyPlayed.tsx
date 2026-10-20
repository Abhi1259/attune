import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { MediaCard, MediaGrid } from '../components/MediaCard'
import { ErrorState, Spinner } from '../components/ui'
import { relativePlayedAt } from '../lib/format'
import { pickImage } from '../lib/types'
import { playerEngine } from '../player/engine'

export function RecentlyPlayedView() {
  const query = useQuery({
    queryKey: ['recently-played'],
    queryFn: api.recentlyPlayed,
    staleTime: 60_000
  })

  if (query.isLoading) {
    return <div className="grid place-items-center py-24"><Spinner /></div>
  }
  if (query.isError) {
    return (
      <ErrorState
        title="Could not load history"
        message={query.error instanceof Error ? query.error.message : undefined}
        retry={() => void query.refetch()}
      />
    )
  }

  const rows = query.data?.items ?? []
  // The API may repeat a track; keys combine uri + played_at.
  const seen = new Set<string>()

  return (
    <div className="att-fade-in px-8 py-6">
      <h1 className="mb-5 text-xl font-bold tracking-tight text-ink">Recently played</h1>
      {rows.length === 0 ? (
        <p className="text-sm text-ink-muted">Nothing here yet — play something first.</p>
      ) : (
        <MediaGrid columns={6}>
          {rows.map((row) => {
            const key = `${row.track.uri}-${row.played_at}`
            if (seen.has(key)) return null
            seen.add(key)
            return (
              <MediaCard
                key={key}
                title={row.track.name}
                subtitle={(row.track.artists ?? []).map((a) => a.name).join(', ')}
                badge={relativePlayedAt(row.played_at)}
                art={pickImage(row.track.album?.images, 300)}
                onPlay={() => void playerEngine.play({ uris: [row.track.uri] })}
              />
            )
          })}
        </MediaGrid>
      )}
      <p className="mt-6 text-xs text-ink-faint">
        Spotify only exposes the last 50 recently played items, and only those started on this account.
      </p>
    </div>
  )
}
