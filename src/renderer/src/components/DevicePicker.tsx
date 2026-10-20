import { useEffect, useRef, useState } from 'react'
import { Laptop, Monitor, Smartphone, Speaker, Tablet, Volume2 } from 'lucide-react'
import { playerEngine } from '../player/engine'
import { usePlayer } from '../player/store'
import { cx } from './ui'

const TYPE_ICONS: Record<string, typeof Volume2> = {
  Computer: Laptop,
  Mobile: Smartphone,
  Smartphone: Smartphone,
  Tablet: Tablet,
  Speaker: Speaker,
  TV: Monitor,
  'CastAudio': Volume2
}

export function DevicePicker() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const devices = usePlayer((s) => s.devices)
  const activeDeviceId = usePlayer((s) => s.activeDeviceId)
  const snapshotDeviceId = usePlayer((s) => s.snapshot?.deviceId)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const effectiveActive = activeDeviceId ?? snapshotDeviceId

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 w-8 items-center justify-center rounded text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
        aria-label="Playback devices"
        aria-expanded={open}
        title="Devices"
      >
        <Volume2 size={16} />
      </button>

      {open && (
        <div className="att-fade-in absolute bottom-10 right-0 z-40 max-h-80 w-72 overflow-y-auto rounded-card border border-line bg-elevated p-1.5 shadow-sm att-scroll">
          <p className="px-2.5 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
            Connect devices
          </p>
          {devices.length === 0 && <p className="px-2.5 py-3 text-xs text-ink-muted">No devices visible yet — open Spotify anywhere to surface it.</p>}
          {devices.map((device) => {
            const Icon = TYPE_ICONS[device.type] ?? Volume2
            const active = device.id === effectiveActive
            return (
              <button
                key={`${device.id}-${device.name}`}
                onClick={() => {
                  setOpen(false)
                  void playerEngine.transferTo(device.id, true)
                }}
                className={cx(
                  'flex w-full items-center gap-2.5 rounded px-2.5 py-2 text-left text-xs transition-colors hover:bg-base',
                  active && 'bg-base'
                )}
              >
                <Icon size={15} className="shrink-0 text-ink-muted" />
                <span className="min-w-0 flex-1">
                  <span className={cx('block truncate font-medium', active ? 'text-ink' : 'text-ink-muted')}>{device.name}</span>
                  <span className="block truncate text-[11px] text-ink-faint">{device.type}</span>
                </span>
                {active && (
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: 'var(--att-accent)' }} aria-label="Active" />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
