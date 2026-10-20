import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

export interface WindowState {
  x?: number
  y?: number
  width: number
  height: number
  maximized: boolean
}

export interface AttuneSettings {
  /** Spotify Developer Dashboard Client ID (public, PKCE flow needs no secret) */
  clientId: string
  themeMode: 'system' | 'light' | 'dark'
  /** Derive the accent color from the current album art */
  useArtAccent: boolean
  /** Name shown for this app as a Spotify Connect device / in the tray */
  deviceName: string
  /** Use the in-app Web Playback SDK device (requires castlabs Electron + Premium). Remote control always available */
  inAppStreaming: boolean
  /** Fixed loopback port that must match the redirect URI registered in the dashboard */
  authPort: number
  window: WindowState
}

const DEFAULTS: AttuneSettings = {
  clientId: '',
  themeMode: 'system',
  useArtAccent: true,
  deviceName: 'Attune',
  inAppStreaming: true,
  authPort: 52331,
  window: { width: 1180, height: 780, maximized: false }
}

function settingsPath(): string {
  return path.join(app.getPath('userData'), 'attune-settings.json')
}

function loadSettings(): AttuneSettings {
  try {
    const raw = JSON.parse(fs.readFileSync(settingsPath(), 'utf-8')) as Partial<AttuneSettings>
    return {
      ...DEFAULTS,
      ...raw,
      window: { ...DEFAULTS.window, ...(raw.window ?? {}) }
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export class Settings {
  private data: AttuneSettings = loadSettings()

  get<K extends keyof AttuneSettings>(key: K): AttuneSettings[K] {
    return this.data[key]
  }

  get all(): Readonly<AttuneSettings> {
    return this.data
  }

  set(patch: Partial<AttuneSettings>): AttuneSettings {
    this.data = {
      ...this.data,
      ...patch,
      window: { ...this.data.window, ...(patch.window ?? {}) }
    }
    this.save()
    return { ...this.data }
  }

  /** Persisted separately from other settings so painting during resize doesn't rewrite client tokens */
  saveWindowState(windowJson: WindowState): void {
    this.data.window = windowJson
    this.save()
  }

  private save(): void {
    try {
      fs.writeFileSync(settingsPath(), JSON.stringify(this.data, null, 2), 'utf-8')
    } catch (err) {
      console.error('[settings] failed to persist:', err)
    }
  }
}
