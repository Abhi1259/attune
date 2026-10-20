import { useEffect, useState } from 'react'
import { getArtwork } from '../lib/artworkCache'
import { cx } from './ui'

export interface ArtworkProps {
  src?: string | null
  alt: string
  imageClassName?: string
  className?: string
  rounded?: boolean
}

/** Spotify CDN URL → proxied data-URL image with graceful fallback. */
export function Artwork({ src, alt, className, imageClassName, rounded }: ArtworkProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [, setTick] = useState(0)

  useEffect(() => {
    let alive = true
    if (!src) {
      setDataUrl(null)
      return
    }
    void getArtwork(src).then((resolved) => {
      if (alive) setDataUrl(resolved)
    })
    return () => {
      alive = false
    }
  }, [src])

  if (!dataUrl) {
    return (
      <div
        className={cx(
          'flex items-center justify-center bg-elevated text-ink-faint',
          rounded && 'rounded-full',
          className
        )}
      >
        <div className="h-1.5 w-1.5 rounded-full bg-line" aria-hidden />
      </div>
    )
  }

  return (
    <img
      src={dataUrl}
      alt={alt}
      draggable={false}
      className={cx('h-full w-full object-cover', rounded && 'rounded-full', imageClassName, className)}
      onLoad={() => setTick((t) => t + 1)}
    />
  )
}
