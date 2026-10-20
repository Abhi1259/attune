import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { TrackList } from '../components/TrackList'
import { MediaCard, MediaGrid } from '../components/MediaCard'
import { SectionHeader, Spinner, ErrorState } from '../components/ui'
import { timeGreeting, relativePlayedAt } from '../lib/format'
import { pickImage, type SpotifyArtist, type SpotifyTrack } from '../lib/types'
import { playerEngine } from '../player/engine'
import { usePlayer } from '../player/store'

export function HomeView() {
  const activeUri = usePlayer((s) => s.snapshot?.track?.uri ?? null)

  const meQuery = useQuery({ queryKey: ['me'], queryFn: api.me, staleTime: 10 * 60_000 })
  const recentQuery = useQuery({ queryKey: ['recently-played'], queryFn: api.recentlyPlayed, staleTime: 60_000 })
  const topTracks = useQuery({
    queryKey: ['top', 'tracks', 'short_term'],
    queryFn: () => api.topItems('tracks', 'short_term', 0, 6)
  })
  const topArtists = useQuery({
    queryKey: ['top', 'artists', 'short_term'],
    queryFn: () => api.topItems('artists', 'short_term', 0, 6)
  })

  // Merge the row timestamp into the track so list keys stay unique
  // (recently-played may include the same track twice at different times).
  const recentTracks = (recentQuery.data?.items ?? []).map((row) => ({
    ...row.track,
    added_at: row.played_at
  }))

  if (recentQuery.isLoading || topArtists.isLoading) {
    return <div className="grid place-items-center py-24"><Spinner /></div>
  }
  if (recentQuery.isError) {
    return (
      <ErrorState
        title="Could not load your overview"
        message={recentQuery.error instanceof Error ? recentQuery.error.message : String(recentQuery.error)}
        retry={() => void recentQuery.refetch()}
      />
    )
  }

  return (
    <div className="att-fade-in flex flex-col gap-10 px-8 py-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          {timeGreeting()}
          {meQuery.data?.display_name ? `, ${meQuery.data.display_name.split(' ')[0]}` : ''}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">Fresh from your account.</p>
      </header>

      <section>
        <SectionHeader title="Recently played" />
        {recentTracks.length === 0 ? (
          <p className="py-6 text-sm text-ink-muted">Play something on any device first — it shows up here.</p>
        ) : (
          <MediaGrid columns={6}>
            {recentTracks.slice(0, 12).map((track) => (
              <MediaCard
                key={`${track.uri}-${track.added_at ?? ''}`}
                title={track.name}
                subtitle={(track.artists ?? []).map((a) => a.name).join(', ')}
                art={pickImage(track.album?.images, 300)}
                onPlay={() => void playerEngine.play({ uris: [track.uri] })}
              />
            ))}
          </MediaGrid>
        )}
      </section>

      <section>
        <SectionHeader title="Your top artists" />
        {topArtists.data?.items?.length ? (
          <MediaGrid columns={6}>
            {(topArtists.data.items as SpotifyArtist[]).slice(0, 6).map((artist) => (
              <MediaCard
                key={artist.id}
                title={artist.name}
                subtitle="Artist"
                round
                art={pickImage(artist.images, 300)}
                to={`/artist/${artist.id}`}
                onPlay={() => void playerEngine.play({ contextUri: artist.uri ?? undefined })}
              />
            ))}
          </MediaGrid>
        ) : (
          <p className="py-6 text-sm text-ink-muted">Not enough listening history yet.</p>
        )}
      </section>

      <section>
        <SectionHeader title="Your top tracks" />
        {topTracks.data?.items?.length ? (
          <div className="max-w-3xl">
            <TrackList tracks={topTracks.data.items as SpotifyTrack[]} activeUri={activeUri} showAlbum showArt />
          </div>
        ) : (
          <p className="py-6 text-sm text-ink-muted">Nothing to show yet.</p>
        )}
      </section>
    </div>
  )
}

/** Re-exported so Recently played can reuse the timestamp formatting. */
export function recentLabel(playedAt: string): string {
  return relativePlayedAt(playedAt)
}
