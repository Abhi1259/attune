/**
 * Renderer-facing type declarations for the Attune preload bridge.
 * Kept explicit here so renderer code stays free of preload module imports.
 */

export interface AuthStatus {
  loggedIn: boolean
  clientIdSet: boolean
  redirectUri: string
  encryptionAvailable: boolean
}

export interface AppInfo {
  platform: string
  appVersion: string
  electronVersion: string
  castlabs: boolean
}

export interface WindowStateDefaults {
  x?: number
  y?: number
  width: number
  height: number
  maximized: boolean
}

export interface AttuneSettings {
  clientId: string
  themeMode: 'system' | 'light' | 'dark'
  useArtAccent: boolean
  deviceName: string
  inAppStreaming: boolean
  authPort: number
  window: WindowStateDefaults
}

type InvokeResult<T> = T

export interface AttuneBridge {
  authStatus(): Promise<InvokeResult<AuthStatus>>
  login(): Promise<InvokeResult<boolean>>
  cancelLogin(): Promise<InvokeResult<boolean>>
  logout(): Promise<InvokeResult<boolean>>
  getAccessToken(): Promise<string>

  getSettings(): Promise<InvokeResult<AttuneSettings>>
  setSettings(patch: Partial<AttuneSettings>): Promise<InvokeResult<AttuneSettings>>

  appInfo(): Promise<InvokeResult<AppInfo>>
  artwork(url: string): Promise<string>
  openExternal(url: string): Promise<InvokeResult<boolean>>
  updateCheck(): Promise<InvokeResult<{ ran: boolean }>>

  window(action: 'minimize' | 'toggleMaximize' | 'close'): Promise<InvokeResult<boolean>>
  trayState(state: { isPlaying: boolean; title: string; artists: string }): Promise<InvokeResult<boolean>>

  onTrayAction(callback: (action: 'togglePlay' | 'next' | 'prev' | 'quit') => void): () => void
}

declare global {
  interface Window {
    attune: AttuneBridge
  }
}

export {}
