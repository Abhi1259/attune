import { X } from 'lucide-react'
import { usePlayer } from '../player/store'

/**
 * Official Spotify embed player (open.spotify.com/embed) — the only token-free,
 * official audio path. Free accounts can use it without Premium; Spotify gates
 * what plays there (full tracks vs previews is their policy, not ours to bypass).
 */
export function EmbedPanel() {
  const embed = usePlayer((s) => s.embed)
  const closeEmbed = usePlayer((s) => s.closeEmbed)

  if (!embed) return null

  const height = embed.type === 'track' ? 152 : 352

  return (
    <section
      className="att-fade-in flex flex-none items-start gap-2 border-t border-line bg-surface px-4 py-3"
      aria-label="Spotify embed player"
    >
      <div className="flex flex-col items-stretch" style={{ width: 'min(560px, 100%)' }}>
        <div className="mb-1.5 flex items-center gap-2">
          <span className="text-[11px] font-medium text-ink-faint">
            Spotify embed · plays by Spotify's own rules (ads/previews on free)
          </span>
          <button
            className="ml-auto flex h-6 w-6 flex-none items-center justify-center rounded text-ink-faint hover:bg-elevated hover:text-ink"
            onClick={closeEmbed}
            aria-label="Close embed player"
          >
            <X size={13} />
          </button>
        </div>
        <iframe
          key={`${embed.type}-${embed.id}`}
          title="Spotify embed player"
          src={`https://open.spotify.com/embed/${embed.type}/${embed.id}?utm_source=attune&theme=0`}
          height={height}
          style={{ border: 0, borderRadius: 10 }}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        />
      </div>
    </section>
  )
}
