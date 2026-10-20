import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useInfiniteList } from '../hooks/useInfiniteList'
import { TrackList } from '../components/TrackList'
import { MediaCard, MediaGrid } from '../components/MediaCard'
import { ViewHeader } from '../components/ViewHeader'
import { Button, ErrorState, Spinner } from '../components/ui'
import { usePlayingUri } from './Playlists'
import { pickImage, type SpotifyAlbum, type SpotifyTrack } from '../lib/types'
import { playerEngine } from '../player/engine'

export function AlbumDetailView() {
  const { albumId = '' } = useParams()
  const activeUri = usePlayingUri()

  const album = useQuery({
    queryKey: ['album', albumId],
    queryFn: () => api.album(albumId),
    enabled: albumId.length > 0,
    staleTime: 10 * 60_000
  })

  const tracks = useInfiniteList<SpotifyTrack>(
    ['album', albumId, 'tracks'],
    (offset, limit) => api.albumTracks(albumId, offset, limit).then((p) => ({ items: p.items as SpotifyTrack[], total: p.total })),
    50
  )

  if (album.isLoading) {
    return <div className="grid place-items-center py-24"><Spinner /></div>
  }
  if (album.isError || !album.data) {
    return (
      <ErrorState
        title="Album unavailable"
        message={album.error instanceof Error ? album.error.message : undefined}
        retry={() => void album.refetch()}
      />
    )
  }

  const data = album.data
  // Album tracks are simplified rows (no album object attached); the header already shows it.
  const rows = tracks.items.map((t) => ({ ...t, album: data }))

  const subtitle = [
    (data.artists ?? []).map((a) => a.name).join(', '),
    data.release_date ? data.release_date.slice(0, 4) : undefined,
    (data.total_tracks ?? undefined) != null ? `${data.total_tracks} songs` : undefined
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="att-fade-in">
      <ViewHeader
        title={data.name}
        subtitle={subtitle}
        meta={data.album_type === 'single' ? 'Single' : 'Album'}
        art={pickImage(data.images, 640)}
        contextUri={data.uri}
        onPlay={() => void playerEngine.play({ contextUri: data.uri })}
        backTo="/"
      />
      <div className="px-8 pb-10">
        <TrackList tracks={rows} activeUri={activeUri} showAlbum={false} showArt={false} contextUri={data.uri} />
        {tracks.canFetchMore && (
          <div className="flex justify-center py-6">
            <Button variant="outline" onClick={() => void tracks.fetchMore()}>
              Load more
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export function ArtistDetailView() {
  const { artistId = '' } = useParams()

  const artist = useQuery({
    queryKey: ['artist', artistId],
    queryFn: () => api.artist(artistId),
    enabled: artistId.length > 0,
    staleTime: 10 * 60_000
  })

  const albums = useInfiniteList<SpotifyAlbum>(
    ['artist', artistId, 'albums'],
    (offset, limit) => api.artistAlbums(artistId, offset, limit).then((p) => ({ items: p.items, total: p.total })),
    30
  )

  if (artist.isLoading) {
    return <div className="grid place-items-center py-24"><Spinner /></div>
  }
  if (artist.isError || !artist.data) {
    return (
      <ErrorState
        title="Artist unavailable"
        message={artist.error instanceof Error ? artist.error.message : undefined}
        retry={() => void artist.refetch()}
      />
    )
  }

  const data = artist.data

  return (
    <div className="att-fade-in">
      <ViewHeader
        title={data.name}
        meta="Artist"
        art={pickImage(data.images, 640)}
        circular
        contextUri={data.uri}
        onPlay={() => void playerEngine.play({ contextUri: data.uri ?? `spotify:artist:${artistId}` })}
        backTo="/"
      />

      <div className="px-8 pb-10">
        <p className="mb-3 text-[15px] font-semibold text-ink">Discography</p>
        <p className="mb-4 text-xs text-ink-muted">
          Note: Spotify removed per-artist “top tracks” from the public API in late 2024 — discography and
          playback start here instead.
        </p>

        <MediaGrid columns={5}>
          {albums.items
            .filter((a) => a.id)
            .map((a) => (
              <MediaCard
                key={`${a.id}-${a.name}`}
                title={a.name}
                subtitle={a.release_date ? a.release_date.slice(0, 4) : ''}
                badge={a.album_type === 'single' ? 'single' : undefined}
                art={pickImage(a.images, 300)}
                to={`/album/${a.id}`}
                onPlay={() => void playerEngine.play({ contextUri: a.uri })}
              />
            ))}
        </MediaGrid>

        {albums.canFetchMore && (
          <div className="flex justify-center py-6">
            <Button variant="outline" onClick={() => void albums.fetchMore()}>
              Load more
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
