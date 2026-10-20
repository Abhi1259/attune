import { useState } from 'react'
import { api } from '../lib/api'
import { useInfiniteList } from '../hooks/useInfiniteList'
import { TrackList } from '../components/TrackList'
import { MediaCard, MediaGrid } from '../components/MediaCard'
import { Button, Spinner, cx } from '../components/ui'
import { usePlayingUri } from './Playlists'
import { pickImage, type SpotifyAlbum, type SpotifyArtist, type SpotifyTrack } from '../lib/types'
import { playerEngine } from '../player/engine'

type Kind = 'tracks' | 'artists'
type Range = 'short_term' | 'medium_term' | 'long_term'

const RANGES: { id: Range; label: string }[] = [
  { id: 'short_term', label: 'Last 4 weeks' },
  { id: 'medium_term', label: 'Last 6 months' },
  { id: 'long_term', label: 'All time' }
]

export function TopView() {
  const [kind, setKind] = useState<Kind>('tracks')
  const [range, setRange] = useState<Range>('short_term')
  const activeUri = usePlayingUri()

  const list = useInfiniteList<SpotifyTrack | SpotifyArtist>(
    ['top', kind, range],
    (offset, limit) =>
      api
        .topItems(kind === 'artists' ? 'artists' : 'tracks', range, offset, limit)
        .then((p) => ({ items: (p.items ?? []) as (SpotifyTrack | SpotifyArtist)[], total: p.total ?? p.items?.length ?? 0 })),
    20
  )

  if (list.loading && list.items.length === 0) {
    return <div className="grid place-items-center py-24"><Spinner /></div>
  }

  return (
    <div className="att-fade-in px-8 py-6">
      <h1 className="mb-4 text-xl font-bold tracking-tight text-ink">Top picks</h1>

      <div className="mb-2 flex items-center gap-1" role="tablist">
        {(['tracks', 'artists'] as Kind[]).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={kind === k}
            onClick={() => setKind(k)}
            className={cx(
              'rounded px-3 py-1.5 text-xs font-medium capitalize transition-colors',
              kind === k ? 'bg-elevated text-ink' : 'text-ink-muted hover:bg-elevated hover:text-ink'
            )}
          >
            {k}
          </button>
        ))}
        <span className="mx-2 h-4 w-px bg-line" aria-hidden />
        {RANGES.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setRange(id)}
            className={cx(
              'rounded px-3 py-1.5 text-xs font-medium transition-colors',
              range === id ? 'bg-elevated text-ink' : 'text-ink-muted hover:bg-elevated hover:text-ink'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {kind === 'tracks' ? (
        <div className="max-w-4xl">
          <TrackList tracks={list.items as SpotifyTrack[]} activeUri={activeUri} showAlbum showArt />
        </div>
      ) : (
        <MediaGrid columns={6}>
          {(list.items as SpotifyArtist[]).map((artist) => (
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
        </MediaGrid>
      )}

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
