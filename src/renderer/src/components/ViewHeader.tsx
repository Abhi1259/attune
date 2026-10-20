import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Heart as HeartIcon } from 'lucide-react'
import { Artwork } from './Artwork'
import { Button } from './ui'
import { useTrackSaved } from '../hooks/useTrackSaved'

export interface ViewHeaderProps {
  title: string
  subtitle?: string
  art?: string | null
  circular?: boolean
  meta?: string
  /** context uri for like/pin (spotify:playlist:… / spotify:album:… / spotify:artist:…) */
  contextUri?: string | null
  onPlay?: () => void
  backTo?: string
}

export function ViewHeader({ title, subtitle, art, circular, meta, contextUri, onPlay, backTo }: ViewHeaderProps) {
  const navigate = useNavigate()
  const saved = useTrackSaved(contextUri ?? null)
  const heartable = Boolean(contextUri)

  return (
    <header className="flex items-end gap-6 px-8 pt-6 pb-5">
      <div className={circular ? 'h-40 w-40 shrink-0 rounded-full overflow-hidden' : 'h-40 w-40 shrink-0 overflow-hidden rounded-card'}>
        <Artwork src={art ?? undefined} alt={title} className="h-40 w-40" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{meta ?? subtitle}</p>
        <h1 className="truncate text-4xl font-bold tracking-tight text-ink">{title}</h1>
        {subtitle && !meta && <p className="mt-1.5 text-sm text-ink-muted">{subtitle}</p>}
        {meta && subtitle && <p className="mt-1 text-xs text-ink-muted">{subtitle}</p>}
        <div className="mt-4 flex items-center gap-2">
          {onPlay && (
            <Button variant="primary" onClick={onPlay}>
              Play
            </Button>
          )}
          {heartable && (
            <button
              className={saved.saved ? 'text-accent' : 'text-ink-faint hover:text-ink'}
              onClick={saved.toggle}
              aria-label={saved.saved ? 'Remove from library' : 'Save to library'}
            >
              <HeartIcon size={22} fill={saved.saved ? 'currentColor' : 'none'} />
            </button>
          )}
        </div>
      </div>
      {backTo ? (
        <button className="mb-1 flex h-8 w-8 items-center justify-center rounded text-ink-faint hover:bg-elevated hover:text-ink" onClick={() => navigate(backTo)} aria-label="Back">
          <ChevronLeft size={18} />
        </button>
      ) : null}
    </header>
  )
}
