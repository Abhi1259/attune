import { MediaCard, MediaGrid } from '../components/MediaCard'
import { Button, ErrorState, Spinner } from '../components/ui'
import { ViewHeader } from '../components/ViewHeader'
import { TrackList } from '../components/TrackList'
import { api } from '../lib/api'
import { useInfiniteList } from '../hooks/useInfiniteList'
import { usePlayingUri } from './Playlists'
import { readTrackRow, pickImage, type SavedAlbumRow, type SavedLibraryRow, type SpotifyTrack } from '../lib/types'
import { playerEngine } from '../player/engine'

export function SavedTracksView() {
  const activeUri = usePlayingUri()

  const list = useInfiniteList<SavedLibraryRow>(
    ['library', 'tracks'],
    (offset, limit) => api.savedTracks(offset, limit).then((p) => ({ items: p.items, total: p.total })),
    50
  )

  if (list.loading && list.items.length === 0) {
    return <div className="grid place-items-center py-24"><Spinner /></div>
  }
  if (list.error) {
    return (
      <ErrorState
        title="Could not load your liked songs"
        message={list.error instanceof Error ? list.error.message : undefined}
        retry={() => void list.refetch()}
      />
    )
  }

  const tracks = list.items
    .map((row) => readTrackRow(row))
    .filter((t): t is SpotifyTrack => Boolean(t))

  return (
    <div className="att-fade-in">
      <ViewHeader
        title="Liked songs"
        subtitle={`${list.total || tracks.length} songs`}
        meta="Your library"
        onPlay={() => tracks[0] && void playerEngine.play({ uris: tracks.slice(0, 50).map((t) => t.uri) })}
      />
      <div className="px-8 pb-10">
        <TrackList
          tracks={tracks}
          activeUri={activeUri}
          showAlbum
          showArt
          savedPreset="saved"
          emptyTitle="No liked songs yet"
          emptyHint="Tap the heart on any track to collect it here."
        />
        {list.canFetchMore && (
          <div className="flex justify-center py-6">
            <Button variant="outline" onClick={() => void list.fetchMore()}>
              Load more
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export function SavedAlbumsView() {
  const list = useInfiniteList<SavedAlbumRow>(
    ['library', 'albums'],
    (offset, limit) => api.savedAlbums(offset, limit).then((p) => ({ items: p.items, total: p.total })),
    30
  )

  if (list.loading && list.items.length === 0) {
    return <div className="grid place-items-center py-24"><Spinner /></div>
  }
  if (list.error) {
    return (
      <ErrorState
        title="Could not load your saved albums"
        message={list.error instanceof Error ? list.error.message : undefined}
        retry={() => void list.refetch()}
      />
    )
  }

  return (
    <div className="att-fade-in px-8 py-6">
      <h1 className="mb-5 text-xl font-bold tracking-tight text-ink">Saved albums</h1>
      <MediaGrid columns={5}>
        {list.items
          .filter((row) => row.album)
          .map((row) => {
            const album = row.album as NonNullable<SavedAlbumRow['album']>
            return (
              <MediaCard
                key={`${album.id}-${row.added_at ?? ''}`}
                title={album.name}
                subtitle={(album.artists ?? []).map((a) => a.name).join(', ')}
                art={pickImage(album.images, 300)}
                to={`/album/${album.id}`}
                onPlay={() => void playerEngine.play({ contextUri: album.uri })}
              />
            )
          })}
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
