import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Heart,
  ListMusic,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  TriangleAlert
} from 'lucide-react'
import { playerEngine } from '../player/engine'
import { usePlayer } from '../player/store'
import { Artwork } from './Artwork'
import { DevicePicker } from './DevicePicker'
import { ProgressSlider } from './ProgressSlider'
import { QueuePanel } from './QueuePanel'
import { VolumeSlider } from './VolumeSlider'
import { useTrackSaved } from '../hooks/useTrackSaved'
import { joinArtists } from '../lib/format'
import { pickImage } from '../lib/types'
import { cx } from './ui'

export function PlayerBar() {
  const navigate = useNavigate()
  const snapshot = usePlayer((s) => s.snapshot)
  const inApp = usePlayer((s) => s.inApp)
  const premiumBlocked = usePlayer((s) => s.premiumBlocked)
  const [queueOpen, setQueueOpen] = useState(false)

  const track = snapshot?.track ?? null
  const isPlaying = snapshot?.isPlaying ?? false
  const saved = useTrackSaved(track?.uri ?? null)
  const art = pickImage(track?.album?.images, 160)

  const repeat = snapshot?.repeat ?? 'off'
  const shuffle = snapshot?.shuffle ?? false

  return (
    <footer className="relative z-30 flex h-[84px] shrink-0 flex-col justify-center gap-1 border-t border-line bg-surface px-4">
      <div className="flex items-center gap-4">
        {/* Track info */}
        <button
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          onClick={() => navigate('/now-playing')}
          aria-label="Open now playing view"
        >
          <div className="h-11 w-11 shrink-0 overflow-hidden rounded">
            <Artwork src={art} alt={track?.album?.name ?? ''} className="h-11 w-11" />
          </div>
          <div className="min-w-0">
            <p className={cx('truncate text-[13px] font-medium', track ? 'text-ink' : 'text-ink-faint')}>
              {track?.name ?? 'Nothing playing'}
            </p>
            <p className="truncate text-xs text-ink-faint">
              {track ? joinArtists(track.artists) : 'Pick a song or a device below'}
            </p>
          </div>
        </button>

        {/* Transport */}
        <div className="flex flex-none items-center gap-1.5">
          <IconToggle active={shuffle} label="Shuffle" onClick={() => void playerEngine.setShuffle(!shuffle)}>
            <Shuffle size={15} />
          </IconToggle>
          <IconToggle label="Previous" onClick={() => void playerEngine.previous()}>
            <SkipBack size={16} />
          </IconToggle>
          <button
            className="mx-1 flex h-9 w-9 items-center justify-center rounded-full text-white transition-transform hover:scale-105"
            style={{ backgroundColor: 'var(--att-ink)' }}
            onClick={() => void playerEngine.togglePlay()}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} className="translate-x-[1px]" />}
          </button>
          <IconToggle label="Next" onClick={() => void playerEngine.next()}>
            <SkipForward size={16} />
          </IconToggle>
          <IconToggle
            label={`Repeat mode: ${repeat}`}
            active={repeat !== 'off'}
            onClick={() => {
              const sequence = { off: 'context', context: 'track', track: 'off' } as const
              void playerEngine.setRepeat(sequence[repeat])
            }}
          >
            {repeat === 'track' ? <Repeat1 size={15} /> : <Repeat size={15} />}
          </IconToggle>
        </div>

        {/* Right cluster */}
        <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
          {inApp.status === 'error' && !premiumBlocked && (
            <span className="mr-1 inline-flex items-center gap-1 rounded-full bg-elevated px-2 py-0.5 text-[11px] text-ink-faint" title={inApp.error}>
              <TriangleAlert size={11} /> remote mode
            </span>
          )}
          <IconToggle label="Like" active={saved.saved} onClick={saved.toggle}>
            <Heart size={15} fill={saved.saved ? 'currentColor' : 'none'} />
          </IconToggle>
          <IconToggle active={queueOpen} label="Queue" onClick={() => setQueueOpen((o) => !o)}>
            <ListMusic size={15} />
          </IconToggle>
          <DevicePicker />
          <VolumeSlider />
        </div>
      </div>

      <div className="mx-auto w-[52%] min-w-[280px]">
        <ProgressSlider />
      </div>

      {queueOpen && <QueuePanel onClose={() => setQueueOpen(false)} />}
    </footer>
  )
}

function IconToggle({
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
        'flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-elevated hover:text-ink',
        active ? 'text-ink' : 'text-ink-muted'
      )}
      style={active ? { color: 'var(--att-accent)' } : undefined}
    >
      {children}
    </button>
  )
}
