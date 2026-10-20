import { Link } from 'react-router-dom'
import { Play } from 'lucide-react'
import { Artwork } from './Artwork'
import { cx } from './ui'

export interface MediaCardProps {
  title: string
  subtitle?: string
  art?: string | null
  round?: boolean
  to?: string
  onPlay?: () => void
  badge?: string
}

export function MediaCard({ title, subtitle, art, round, to, onPlay, badge }: MediaCardProps) {
  const body = (
    <div className="group flex flex-col gap-2 rounded-card p-3 transition-colors hover:bg-elevated">
      <div className={cx('relative aspect-square w-full overflow-hidden bg-elevated', round && 'rounded-full')}>
        <Artwork src={art ?? undefined} alt={title} className="absolute inset-0 h-full w-full" />
        {onPlay && (
          <button
            className="absolute bottom-2 right-2 flex h-9 w-9 translate-y-1 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              onPlay()
            }}
            aria-label={`Play ${title}`}
          >
            <Play size={14} className="translate-x-px" />
          </button>
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium text-ink">{title}</p>
        <p className="truncate text-xs text-ink-faint">
          {badge ? (
            <span className="mr-1 rounded-sm bg-line px-1 capitalize text-[10px] font-semibold uppercase tracking-wide text-ink-muted">{badge}</span>
          ) : null}
          {subtitle}
        </p>
      </div>
    </div>
  )

  if (to) {
    return (
      <Link to={to} className="block" title={title}>
        {body}
      </Link>
    )
  }
  return <div title={title}>{body}</div>
}

/** Flat grid for artist/album/playlist tiles. */
export function MediaGrid({ children, columns = 5 }: { children: React.ReactNode; columns?: number }) {
  const colClass =
    columns >= 6
      ? 'grid-cols-2 sm:grid-cols-4 md:grid-cols-6'
      : columns === 4
        ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'
        : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
  return <div className={cx('grid gap-1', colClass)}>{children}</div>
}
