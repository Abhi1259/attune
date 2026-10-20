import { useState } from 'react'
import { Volume1, Volume2, VolumeX } from 'lucide-react'
import { playerEngine } from '../player/engine'
import { usePlayer } from '../player/store'

export function VolumeSlider() {
  const volume = usePlayer((s) => s.volume)
  const [preview, setPreview] = useState<number | null>(null)
  const shown = preview ?? volume

  const icon =
    shown === 0 ? (
      <VolumeX size={16} />
    ) : shown < 50 ? (
      <Volume1 size={16} />
    ) : (
      <Volume2 size={16} />
    )

  return (
    <div className="flex items-center gap-1.5 text-ink-muted">
      <button
        className="flex h-7 w-7 items-center justify-center rounded hover:bg-elevated hover:text-ink transition-colors"
        aria-label={shown === 0 ? 'Unmute' : 'Mute'}
        onClick={() => void playerEngine.setVolume(shown === 0 ? 70 : 0)}
      >
        {icon}
      </button>
      <input
        type="range"
        className="att-range w-24"
        aria-label="Volume"
        min={0}
        max={100}
        step={1}
        value={shown}
        style={{ ['--att-range-progress' as string]: `${shown}%` }}
        onInput={(e) => setPreview(Number((e.target as HTMLInputElement).value))}
        onChange={(e) => {
          const pct = Number((e.target as HTMLInputElement).value)
          setPreview(null)
          void playerEngine.setVolume(pct)
        }}
      />
      <span className="w-7 text-[11px] tabular-nums text-ink-faint">{Math.round(shown)}</span>
    </div>
  )
}
