import { app, Menu, nativeImage, Tray } from 'electron'
import path from 'node:path'

export interface TrayState {
  isPlaying: boolean
  title: string
  artists: string
}

/** Locates bundled files in dev (repo root/build) vs packaged app (resources/). */
export function appResource(name: string): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, name)
    : path.join(app.getAppPath(), 'build', name)
}

/**
 * System tray mini-player (Windows/Linux). Renderer pushes state; menu actions
 * are relayed back to the window as `player:tray-action` IPC events.
 * On macOS the tray is skipped by default — the native titlebar UX is primary there.
 */
export class AttuneTray {
  private tray: Tray | null = null
  private state: TrayState = { isPlaying: false, title: '', artists: '' }

  constructor(
    private readonly onFocus: () => void,
    private readonly onAction: (action: 'togglePlay' | 'next' | 'prev' | 'quit') => void
  ) {
    if (process.platform === 'darwin') return
    try {
      const image = nativeImage.createFromPath(appResource('tray.png'))
      if (image.isEmpty()) {
        console.warn('[tray] tray icon not found; tray disabled')
        return
      }
      this.tray = new Tray(image)
      this.tray.setToolTip('Attune')
      this.tray.on('click', () => this.onFocus())
      this.rebuildMenu()
    } catch (err) {
      console.warn('[tray] unavailable:', err)
    }
  }

  update(state: TrayState): void {
    this.state = state
    const trackLine = state.title
      ? `${state.isPlaying ? '▶' : '❚❚'} ${truncate(state.title, 24)}`
      : 'idle'
    if (this.tray && !this.tray.isDestroyed()) this.tray.setToolTip(`Attune — ${trackLine}`)
    this.rebuildMenu()
  }

  private rebuildMenu(): void {
    if (!this.tray || this.tray.isDestroyed()) return
    const trackLine = this.state.title
      ? [this.state.title, this.state.artists].filter(Boolean).join(' — ')
      : 'Nothing playing'
    const menu = Menu.buildFromTemplate([
      { label: truncate(trackLine, 48), enabled: false },
      { type: 'separator' },
      {
        label: this.state.isPlaying ? 'Pause' : 'Play',
        click: () => this.onAction('togglePlay')
      },
      { label: 'Next', click: () => this.onAction('next') },
      { label: 'Previous', click: () => this.onAction('prev') },
      { type: 'separator' },
      { label: 'Show Attune', click: ()=> this.onFocus() },
      { label: 'Quit Attune', click: () => this.onAction('quit') }
    ])
    this.tray.setContextMenu(menu)
  }

  destroy(): void {
    if (this.tray && !this.tray.isDestroyed()) this.tray.destroy()
    this.tray = null
  }
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}
