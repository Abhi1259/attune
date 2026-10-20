import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, MoreHorizontal, Play } from 'lucide-react'
import type { SpotifyTrack } from '../lib/types'
import { playerEngine } from '../player/engine'
import { usePlayer } from '../player/store'
import { Artwork } from './Artwork'
import { useTrackSaved, type SavedPreset } from '../hooks/useTrackSaved'
import { formatDuration, joinArtists } from '../lib/format'
import { pickImage } from '../lib/types'
import { cx, EmptyState } from './ui'

export interface TrackListProps {
  tracks: SpotifyTrack[]
  /** uri of the currently playing track (for highlight) */
  activeUri?: string | null
  showAlbum?: boolean
  showArt?: boolean
  /** Explicit context to play (album/playlist uri); defaults to the displayed list itself. */
  contextUri?: string
  /** 'saved' skips per-row contains checks (Liked-songs view); default 'lookup'. */
  savedPreset?: SavedPreset
  emptyTitle?: string
  emptyHint?: string
}

export function TrackList({
  tracks,
  activeUri,
  showAlbum = true,
  showArt = true,
  contextUri,
  savedPreset = 'lookup',
  emptyTitle = 'Nothing here yet',
  emptyHint
}: TrackListProps) {
  if (tracks.length === 0) return <EmptyState title={emptyTitle} hint={emptyHint} />

  const uris = tracks.map((t) => t.uri)

  return (
    <div className="flex flex-col" role="list">
      {tracks.map((track, index) => (
        <TrackRow
          key={`${track.id}-${index}`}
          index={index}
          track={track}
          active={track.uri === activeUri}
          showAlbum={showAlbum}
          showArt={showArt}
          playListUris={uris}
          contextUri={contextUri}
          savedPreset={savedPreset}
        />
      ))}
    </div>
  )
}

interface TrackRowProps {
  track: SpotifyTrack
  index: number
  active: boolean
  showAlbum: boolean
  showArt: boolean
  playListUris: string[]
  contextUri?: string
  savedPreset?: SavedPreset
}

export function TrackRow({ track, index, active, showAlbum, showArt, playListUris, contextUri, savedPreset = 'lookup' }: TrackRowProps) {
  const navigate = useNavigate()
  const saved = useTrackSaved(track.uri, savedPreset)
  const [menuOpen, setMenuOpen] = useState(false)

  const play = () => {
    const offsetPosition = playListUris.indexOf(track.uri)
    if (contextUri) {
      void playerEngine.play({ contextUri, offset: { position: offsetPosition >= 0 ? offsetPosition : 0 } })
    } else {
      void playerEngine.play({ uris: playListUris, offset: { position: offsetPosition >= 0 ? offsetPosition : index } })
    }
  }

  const albumId = track.album?.id
  const artist = track.artists?.[0]
  const art = pickImage(track.album?.images, 160)

  return (
    <div
      role="listitem"
      className={cx(
        'group flex items-center gap-3 rounded px-2 py-1.5 transition-colors',
        active ? 'bg-elevated' : 'hover:bg-elevated'
      )}
      onDoubleClick={play}
    >
      <span
        className={cx('w-6 flex-none text-right text-xs tabular-nums', active ? 'text-ink' : 'text-ink-faint')}
        onClick={play}
      >
        {active ? <span className="inline-flex h-4 w-4 items-center justify-center rounded-full" style={{ backgroundColor: 'var(--att-accent)' }}><Play size={9} className="text-white translate-x-px" /></span> : index + 1}
      </span>

      {showArt && (
        <div className="relative h-9 w-9 flex-none overflow-hidden rounded">
          <Artwork src={art} alt="" className="h-9 w-9" />
          <button className="absolute inset-0 items-center justify-center bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100" style={{ display: 'flex' }} onClick={play} aria-label={`Play ${track.name}`}>
            <Play size={13} />
          </button>
        </div>
      )}

      {/* Title + artists; single click plays */}
      <div className={cx('min-w-0 flex-1 cursor-pointer', 'select-none')} onClick={play} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && play()} aria-label={`Play ${track.name}`}>
        <p className={cx('truncate text-[13px]', active ? 'font-semibold text-ink' : 'font-medium text-ink')}>{track.name}</p>
        <p className="truncate text-xs text-ink-faint">
          {(track.artists ?? []).map((a, i) => (
            <span key={`${a.id ?? i}-${a.name}`}>
              {i > 0 && ', '}
              <span
                className="hover:text-ink-muted"
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation()
                  if (a.id) navigate(`/artist/${a.id}`)
                }}
              >
                {a.name}
              </span>
            </span>
          ))}
          {!track.artists?.length && joinArtists(track.artists)}
        </p>
      </div>

      {showAlbum && track.album?.name && (
        <button
          className="hidden w-44 flex-none truncate text-left text-xs text-ink-faint hover:text-ink md:block"
          onClick={() => albumId && navigate(`/album/${albumId}`)}
          title={track.album.name}
        >
          {track.album.name}
        </button>
      )}

      <div className="flex flex-none items-center gap-1">
        <button
          className={cx(
            'flex h-7 w-7 items-center justify-center rounded transition-opacity',
            saved.saved ? 'text-accent' : 'text-ink-faint opacity-0 group-hover:opacity-100 focus:opacity-100'
          )}
          onClick={saved.toggle}
          aria-label={saved.saved ? 'Remove from liked songs' : 'Save to liked songs'}
        >
          <Heart size={14} fill={saved.saved ? 'currentColor' : 'none'} />
        </button>
        <span className="w-10 text-right text-xs tabular-nums text-ink-faint">{formatDuration(track.duration_ms)}</span>
        <div className="relative">
          <button
            className="flex h-7 w-7 items-center justify-center rounded text-ink-faint opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 hover:text-ink"
            aria-label="Track menu"
            aria-expanded={menuOpen}
            onClick={(e) => {
              e.stopPropagation()
              setMenuOpen(!menuOpen)
            }}
          >
            <MoreHorizontal size={15} />
          </button>
          {menuOpen && (
            <TrackMenu
              onClose={() => setMenuOpen(false)}
              onQueue={() => void playerEngine.addToQueue(track.uri)}
              albumId={albumId}
              artistId={artist?.id}
              onOpenAlbum={() => albumId && navigate(`/album/${albumId}`)}
              onOpenArtist={() => artist?.id && navigate(`/artist/${artist.id}`)}
            />
          )}
        </div>
      </div>
    </div>
  )
}

interface TrackMenuProps {
  onClose: () => void
  onQueue: () => void
  onOpenAlbum?: () => void
  onOpenArtist?: () => void
  albumId?: string | null
  artistId?: string | null
}

function TrackMenu({
  onClose,
  onQueue,
  onOpenAlbum,
  onOpenArtist,
  albumId,
  artistId
}: TrackMenuProps) {
  return (
    <div
      className="att-fade-in absolute right-0 top-8 z-40 w-44 overflow-hidden rounded border border-line bg-elevated py-1 shadow-sm"
      onMouseLeave={onClose}
    >
      <MenuItem label="Add to queue" onClick={() => { onQueue(); onClose() }} />
      {albumId && <MenuItem label="Go to album" onClick={() => { onOpenAlbum?.(); onClose() }} />}
      {artistId && <MenuItem label="Go to artist" onClick={() => { onOpenArtist?.(); onClose() }} />}
    </div>
  )
}

function MenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="block w-full px-3 py-1.5 text-left text-xs text-ink-muted hover:bg-base hover:text-ink" onClick={onClick}>
      {label}
    </button>
  )
}
