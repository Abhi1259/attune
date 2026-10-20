import { useState } from 'react'
import { playerEngine } from '../player/engine'
import { liveProgress, usePlayer } from '../player/store'
import { formatDuration } from '../lib/format'

/** Seek bar with local drag preview (commit on change, not on every input event). */
export function ProgressSlider({ large = false }: { large?: boolean }) {
  const snapshot = usePlayer((s) => s.snapshot)
  const [previewMs, setPreviewMs] = useState<number | null>(null)

  const duration = snapshot?.durationMs ?? 0
  const current = previewMs ?? liveProgress(snapshot)
  const pct = duration > 0 ? Math.min(100, (current / duration) * 100) : 0
  const disabled = !snapshot || duration <= 0

  return (
    <div className="flex w-full items-center gap-2 text-[11px] tabular-nums text-ink-faint">
      <span className="w-10 text-right">{formatDuration(current)}</span>
      <input
        type="range"
        className="att-range flex-1"
        aria-label="Track progress"
        min={0}
        max={duration}
        step={500}
        value={disabled ? 0 : current}
        disabled={disabled}
        style={{ ['--att-range-progress' as string]: `${pct}%` }}
        onInput={(e) => setPreviewMs(Number((e.target as HTMLInputElement).value))}
        onChange={(e) => {
          const ms = Number((e.target as HTMLInputElement).value)
          setPreviewMs(null)
          void playerEngine.seek(ms)
        }}
      />
      <span className="w-10">{formatDuration(duration)}</span>
      {large && null}
    </div>
  )
}
