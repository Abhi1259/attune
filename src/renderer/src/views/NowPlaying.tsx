import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Heart, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward } from 'lucide-react'
import { playerEngine } from '../player/engine'
import { usePlayer } from '../player/store'
import { Artwork } from '../components/Artwork'
import { ProgressSlider } from '../components/ProgressSlider'
import { VolumeSlider } from '../components/VolumeSlider'
import { useTrackSaved } from '../hooks/useTrackSaved'
import { joinArtists } from '../lib/format'
import { pickImage } from '../lib/types'
import { cx } from '../components/ui'

/** Full-page now-playing surface. Layout stays flat: art, metadata, controls. */
export function NowPlayingView() {
  const navigate = useNavigate()
  const snapshot = usePlayer((s) => s.snapshot)
  const track = snapshot?.track ?? null
  const isPlaying = snapshot?.isPlaying ?? false
  const repeat = snapshot?.repeat ?? 'off'
  const shuffle = snapshot?.shuffle ?? false
  const saved = useTrackSaved(track?.uri ?? null)
  const art = pickImage(track?.album?.images, 640)

  return (
    <div
      className="att-fade-in relative flex h-full flex-col px-10 py-8"
      style={{ backgroundColor: 'color-mix(in srgb, var(--att-accent) 6%, transparent)' }}
    >
      <button
        className="absolute left-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-surface text-ink-muted transition-colors hover:text-ink"
        onClick={() => navigate(-1)}
        aria-label="Back"
      >
        <ChevronLeft size={16} />
      </button>

      <div className="flex min-h-0 flex-1 items-center justify-center gap-14">
        <div className="aspect-square w-[min(42vh,38%)] max-w-[420px] overflow-hidden rounded-card shadow-sm">
          <Artwork src={art} alt={track?.album?.name ?? ''} className="h-full w-full" />
        </div>

        <div className="flex min-w-0 flex-col gap-6" style={{ minWidth: 320 }}>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Now playing</p>
            <h1 className="mt-1 truncate text-3xl font-bold tracking-tight text-ink">
              {track?.name ?? 'Nothing playing'}
            </h1>
            <p className="mt-1.5 truncate text-sm text-ink-muted">
              {track ? joinArtists(track.artists) : 'Choose a song and press play.'}
            </p>
            {track?.album?.name && <p className="truncate text-xs text-ink-faint">from {track.album.name}</p>}
          </div>

          <ProgressSlider large />

          <div className="flex items-center gap-3">
            <GhostToggle active={shuffle} label="Shuffle" onClick={() => void playerEngine.setShuffle(!shuffle)}>
              <Shuffle size={16} />
            </GhostToggle>
            <GhostToggle label="Previous" onClick={() => void playerEngine.previous()}>
              <SkipBack size={18} />
            </GhostToggle>
            <button
              className="flex h-12 w-12 items-center justify-center rounded-full text-white transition-transform hover:scale-105"
              style={{ backgroundColor: 'var(--att-ink)' }}
              onClick={() => void playerEngine.togglePlay()}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause size={20} /> : <Play size={20} className="translate-x-[1px]" />}
            </button>
            <GhostToggle label="Next" onClick={() => void playerEngine.next()}>
              <SkipForward size={18} />
            </GhostToggle>
            <GhostToggle
              label={`Repeat: ${repeat}`}
              active={repeat !== 'off'}
              onClick={() => {
                const sequence = { off: 'context', context: 'track', track: 'off' } as const
                void playerEngine.setRepeat(sequence[repeat])
              }}
            >
              {repeat === 'track' ? <Repeat1 size={16} /> : <Repeat size={16} />}
            </GhostToggle>
            <GhostToggle label="Like" active={saved.saved} onClick={saved.toggle}>
              <Heart size={16} fill={saved.saved ? 'currentColor' : 'none'} />
            </GhostToggle>
          </div>

          <div className="max-w-xs">
            <VolumeSlider />
          </div>
        </div>
      </div>
    </div>
  )
}

function GhostToggle({
  children,
  label,
  active,
  onClick
}: {
  children: React.ReactNode
  label: string
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cx(
        'flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-base',
        active ? 'text-ink' : 'text-ink-muted'
      )}
      style={active ? { color: 'var(--att-accent)' } : undefined}
    >
      {children}
    </button>
  )
}
