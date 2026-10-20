import { Minus, Square, X } from 'lucide-react'

/** Custom titlebar for frameless windows (Windows/Linux). macOS keeps native traffic lights. */
export function Titlebar() {
  const iconBtn =
    'att-no-drag flex h-full w-11 items-center justify-center text-ink-muted hover:bg-elevated hover:text-ink transition-colors'

  return (
    <header className="att-drag relative flex h-9 shrink-0 select-none items-center justify-end border-b border-line">
      <div className="pointer-events-none absolute left-3 flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: 'var(--att-accent)' }} aria-hidden />
        <span className="text-xs font-semibold tracking-wide text-ink-faint">ATTUNE</span>
      </div>
      <button className={iconBtn} aria-label="Minimize" onClick={() => void window.attune.window('minimize')}>
        <Minus size={14} />
      </button>
      <button className={iconBtn} aria-label="Maximize or restore" onClick={() => void window.attune.window('toggleMaximize')}>
        <Square size={12} />
      </button>
      <button className={`${iconBtn} hover:bg-[#c0392b] hover:text-white`} aria-label="Close" onClick={() => void window.attune.window('close')}>
        <X size={14} />
      </button>
    </header>
  )
}
