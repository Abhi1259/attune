import { X, ListMusic } from 'lucide-react'
import { usePlayer } from '../player/store'
import { Artwork } from './Artwork'
import { formatDuration } from '../lib/format'
import { pickImage } from '../lib/types'

export function QueuePanel({ onClose }: { onClose: () => void }) {
  const queue = usePlayer((s) => s.queue)
  const current = usePlayer((s) => s.snapshot?.track ?? null)

  return (
    <div className="att-fade-in absolute bottom-10 right-2 z-40 w-[340px] overflow-hidden rounded-card border border-line bg-elevated shadow-sm">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <div className="flex items-center gap-2">
          <ListMusic size={14} className="text-ink-muted" />
          <span className="text-xs font-semibold text-ink">Queue</span>
        </div>
        <button className="flex h-6 w-6 items-center justify-center rounded text-ink-faint hover:bg-base hover:text-ink" onClick={onClose} aria-label="Close queue">
          <X size={14} />
        </button>
      </div>

      <div className="att-scroll max-h-[46vh] overflow-y-auto p-1.5">
        {!current && <p className="px-2.5 py-3 text-xs text-ink-muted">Nothing playing yet.</p>}

        {current && (
          <>
            <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Playing now</p>
            <QueueRow name={current.name} artists={(current.artists ?? []).map((a) => a.name)} durationMs={current.duration_ms} art={pickImage(current.album?.images, 160)} />

            <p className="px-2.5 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Next up</p>
            {queue && queue.length > 0 ? (
              queue.slice(0, 30).map((t) => (
                <QueueRow
                  key={`${t.uri}-${t.id}`}
                  name={t.name}
                  artists={(t.artists ?? []).map((a) => a.name)}
                  durationMs={t.duration_ms}
                  art={pickImage(t.album?.images, 160)}
                />
              ))
            ) : (
              <p className="px-2.5 py-2 text-xs text-ink-muted">{queue ? 'Queue is empty.' : 'Loading…'}</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function QueueRow({ name, artists, durationMs, art }: { name: string; artists: string[]; durationMs: number; art?: string | null }) {
  return (
    <div className="flex items-center gap-2.5 rounded px-2.5 py-1.5">
      <div className="h-8 w-8 shrink-0 overflow-hidden rounded">
        <Artwork src={art} alt={name} className="h-8 w-8" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-ink">{name}</p>
        <p className="truncate text-[11px] text-ink-faint">{artists.join(', ')}</p>
      </div>
      <span className="text-[11px] tabular-nums text-ink-faint">{formatDuration(durationMs)}</span>
    </div>
  )
}
