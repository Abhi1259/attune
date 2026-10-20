import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useInfiniteList } from '../hooks/useInfiniteList'
import { TrackList } from '../components/TrackList'
import { MediaCard, MediaGrid } from '../components/MediaCard'
import { ViewHeader } from '../components/ViewHeader'
import { Button, ErrorState, Spinner } from '../components/ui'
import { readTrackRow, pickImage, type PlaylistItemRow, type SpotifyPlaylistSummary, type SpotifyTrack } from '../lib/types'
import { playerEngine } from '../player/engine'
import { usePlayer } from '../player/store'

/** Highlight the row matching the playing track. */
export function usePlayingUri(): string | null {
  return usePlayer((s) => s.snapshot?.track?.uri ?? null)
}

export function PlaylistsView() {
  const list = useInfiniteList<SpotifyPlaylistSummary>(
    ['me', 'playlists'],
    (offset, limit) => api.playlists(offset, limit).then((p) => ({ items: p.items, total: p.total })),
    30
  )

  if (list.loading && list.items.length === 0) {
    return <div className="grid place-items-center py-24"><Spinner /></div>
  }
  if (list.error) {
    return (
      <ErrorState
        title="Could not load playlists"
        message={list.error instanceof Error ? list.error.message : undefined}
        retry={() => void list.refetch()}
      />
    )
  }

  return (
    <div className="att-fade-in px-8 py-6">
      <h1 className="mb-5 text-xl font-bold tracking-tight text-ink">Playlists</h1>
      <MediaGrid columns={5}>
        {list.items.map((pl) => (
          <MediaCard
            key={`${pl.id}-${pl.name}`}
            title={pl.name}
            subtitle={pl.owner?.display_name ? `By ${pl.owner.display_name}` : 'Playlist'}
            art={pickImage(pl.images, 300)}
            to={`/playlists/${pl.id}`}
            onPlay={() => void playerEngine.play({ contextUri: pl.uri })}
          />
        ))}
      </MediaGrid>
      {list.canFetchMore && (
        <div className="flex justify-center py-6">
          <Button variant="outline" onClick={() => void list.fetchMore()}>
            Load more
          </Button>
        </div>
      )}
    </div>
  )
}

export function PlaylistDetailView() {
  const { playlistId = '' } = useParams()
  const activeUri = usePlayingUri()

  const detail = useQuery({
    queryKey: ['playlist', playlistId],
    queryFn: () => api.playlist(playlistId),
    enabled: playlistId.length > 0,
    staleTime: 120_000
  })

  const items = useInfiniteList<PlaylistItemRow>(
    ['playlist', playlistId, 'items'],
    (offset, limit) =>
      api.playlistItems(playlistId, offset, limit).then((p) => ({ items: p.items, total: p.total })),
    50
  )

  if (detail.isLoading) {
    return <div className="grid place-items-center py-24"><Spinner /></div>
  }
  if (detail.isError || !detail.data) {
    return (
      <ErrorState
        title="Playlist unavailable"
        message={detail.error instanceof Error ? detail.error.message : undefined}
        retry={() => void detail.refetch()}
      />
    )
  }

  const playlist = detail.data
  const tracks = items.items
    .map((row) => readTrackRow(row))
    .filter((t): t is SpotifyTrack => Boolean(t))

  const total = playlist.items?.total ?? playlist.tracks?.total ?? null
  const subtitle = [
    playlist.owner?.display_name ? `By ${playlist.owner.display_name}` : undefined,
    total != null ? `${total} songs` : undefined
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div>
      <ViewHeader
        title={playlist.name}
        subtitle={subtitle}
        meta="Playlist"
        art={pickImage(playlist.images, 640)}
        contextUri={playlist.uri}
        onPlay={() => void playerEngine.play({ contextUri: playlist.uri })}
        backTo="/playlists"
      />
      <div className="px-8 pb-10">
        <TrackList
          tracks={tracks}
          activeUri={activeUri}
          showAlbum
          showArt
          emptyTitle={items.loading ? 'Loading…' : 'Playlist is empty'}
        />
        {items.canFetchMore && (
          <div className="flex justify-center py-6">
            <Button variant="outline" onClick={() => void items.fetchMore()}>
              Load more
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
