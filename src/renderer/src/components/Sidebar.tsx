import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Disc3,
  Heart,
  History,
  Home,
  Library,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  UserRound
} from 'lucide-react'
import { cx } from './ui'

interface NavItem {
  to: string
  label: string
  icon: typeof Home
  end?: boolean
}

const ITEMS: NavItem[] = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/playlists', label: 'Playlists', icon: Library },
  { to: '/saved-tracks', label: 'Liked songs', icon: Heart },
  { to: '/saved-albums', label: 'Saved albums', icon: Disc3 },
  { to: '/top', label: 'Top picks', icon: UserRound },
  { to: '/recently-played', label: 'Recently played', icon: History },
  { to: '/settings', label: 'Settings', icon: Settings }
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <nav
      className={cx(
        'flex h-full shrink-0 flex-col justify-between border-r border-line bg-surface transition-all duration-200',
        collapsed ? 'w-16' : 'w-56'
      )}
    >
      <div className="flex flex-col gap-0.5 p-2">
        {ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={label}
            className={({ isActive }) =>
              cx(
                'flex items-center gap-3 rounded px-3 py-2 text-[13px] font-medium text-ink-muted transition-colors hover:bg-elevated hover:text-ink',
                isActive && 'text-ink',
                collapsed && 'justify-center px-0'
              )
            }
          >
            <Icon size={18} strokeWidth={1.8} />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </div>

      <div className="flex items-center justify-end p-2">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex h-8 w-8 items-center justify-center rounded text-ink-faint transition-colors hover:bg-elevated hover:text-ink"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>
    </nav>
  )
}
