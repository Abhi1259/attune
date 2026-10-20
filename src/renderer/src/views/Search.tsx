import { useEffect, useState } from 'react'
import { Search as SearchIcon } from 'lucide-react'
import { api } from '../lib/api'
import { useInfiniteList } from '../hooks/useInfiniteList'
import { TrackList } from '../components/TrackList'
import { MediaCard, MediaGrid } from '../components/MediaCard'
import { Button, Spinner, TextInput } from '../components/ui'
import { usePlayer } from '../player/store'
import { playerEngine } from '../player/engine'
import { pickImage, type SpotifyAlbum, type SpotifyArtist, type SpotifyPlaylistSummary, type SpotifyTrack } from '../lib/types'

type Tab = 'tracks' | 'albums' | 'artists' | 'playlists'
type AnyItem = SpotifyTrack | SpotifyAlbum | SpotifyArtist | SpotifyPlaylistSummary

const TABS: { id: Tab; label: string }[] = [
  { id: 'tracks', label: 'Songs' },
  { id: 'albums', label: 'Albums' },
  { id: 'artists', label: 'Artists' },
  { id: 'playlists', label: 'Playlists' }
]

async function fetchType(tab: Tab, query: string, offset: number, limit: number) {
  const res = await api.search(query, tab, limit, offset)
  if (tab === 'tracks') return { items: (res.tracks?.items ?? []) as AnyItem[], total: res.tracks?.total ?? 0 }
  if (tab === 'albums') return { items: (res.albums?.items ?? []) as AnyItem[], total: res.albums?.total ?? 0 }
  if (tab === 'artists') return { items: (res.artists?.items ?? []) as AnyItem[], total: res.artists?.total ?? 0 }
  return { items: (res.playlists?.items ?? []) as AnyItem[], total: res.playlists?.total ?? 0 }
}

export function SearchView() {
  const [tab, setTab] = useState<Tab>('tracks')
  const [raw, setRaw] = useState('')
  const [query, setQuery] = useState('')
  const activeUri = usePlayer((s) => s.snapshot?.track?.uri ?? null)

  // Debounce the network-facing query while the input stays responsive.
  useEffect(() => {
    const t = setTimeout(() => setQuery(raw.trim()), 350)
    return () => clearTimeout(t)
  }, [raw])

  const ready = query.length >= 2

  return (
    <div className="att-fade-in flex flex-col gap-6 px-8 py-6">
      <div className="relative max-w-md">
        <SearchIcon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
        <TextInput
          className="pl-9"
          placeholder="Search Spotify"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          aria-label="Search Spotify"
          autoFocus
        />
      </div>

      <div className="flex items-center gap-1" role="tablist">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            role="tab"
            aria-selected={tab === id}
            className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === id ? 'bg-elevated text-ink' : 'text-ink-muted hover:bg-elevated hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {!ready ? (
        <p className="py-12 text-sm text-ink-muted">Type at least two characters to search.</p>
      ) : (
        <SearchResults tab={tab} query={query} activeUri={activeUri} />
      )}
    </div>
  )
}

function SearchResults({ tab, query, activeUri }: { tab: Tab; query: string; activeUri: string | null }) {
  const list = useInfiniteList<AnyItem>(['search', tab, query], (offset, limit) => fetchType(tab, query, offset, limit), 20)

  if (list.loading && list.items.length === 0) {
    return <div className="grid place-items-center py-20"><Spinner /></div>
  }
  if (list.error) {
    return <p className="py-12 text-sm text-ink-muted">Search failed — try again in a moment.</p>
  }
  if (list.items.length === 0) {
    return <p className="py-12 text-sm text-ink-muted">No {tab} matched “{query}”.</p>
  }

  if (tab === 'tracks') {
    const tracks = list.items as SpotifyTrack[]
    return (
      <div className="max-w-4xl">
        <TrackList tracks={tracks} activeUri={activeUri} showAlbum showArt />
      </div>
    )
  }

  return (
    <>
      <MediaGrid columns={tab === 'artists' ? 6 : 5}>
        {tab === 'artists' &&
          (list.items as SpotifyArtist[]).map((artist) => (
            <MediaCard
              key={artist.id}
              title={artist.name}
              subtitle="Artist"
              round
              art={pickImage(artist.images, 300)}
              to={`/artist/${artist.id}`}
              onPlay={() => void playerEngine.play({ contextUri: `spotify:artist:${artist.id}` })}
            />
          ))}
        {tab === 'albums' &&
          (list.items as SpotifyAlbum[]).map((album) => (
            <MediaCard
              key={`${album.id}-${album.name}`}
              title={album.name}
              subtitle={`${album.release_date?.slice(0, 4) ?? ''} · ${(album.artists ?? []).map((a) => a.name).join(', ')}`}
              badge={album.album_type === 'single' ? 'single' : undefined}
              art={pickImage(album.images, 300)}
              to={`/album/${album.id}`}
              onPlay={() => void playerEngine.play({ contextUri: `spotify:album:${album.id}` })}
            />
          ))}
        {tab === 'playlists' &&
          (list.items as SpotifyPlaylistSummary[]).map((pl) => (
            <MediaCard
              key={`${pl.id}-${pl.name}`}
              title={pl.name}
              subtitle={pl.owner?.display_name ? `By ${pl.owner.display_name}` : 'Playlist'}
              art={pickImage(pl.images, 300)}
              to={`/playlists/${pl.id}`}
              onPlay={() => void playerEngine.play({ contextUri: `spotify:playlist:${pl.id}` })}
            />
          ))}
      </MediaGrid>

      {list.canFetchMore && (
        <div className="flex justify-center py-4">
          <Button variant="outline" onClick={() => void list.fetchMore()}>
            Load more
          </Button>
        </div>
      )}
    </>
  )
}
