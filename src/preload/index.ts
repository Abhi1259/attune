import { contextBridge, ipcRenderer } from 'electron'

/** Wraps ipcMain.handle results ({ok,data}|{ok:false,error,code?}) into promise resolve/reject. */
async function invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T> {
  const result = (await ipcRenderer.invoke(channel, ...args)) as
    | { ok: true; data: T }
    | { ok: false; error: string; code?: string }
  if (result && typeof result === 'object' && 'ok' in result) {
    if (result.ok) return result.data
    const err = new Error(result.error) as Error & { code?: string }
    err.code = result.code
    throw err
  }
  return result as T
}

const bridge = {
  // Account / OAuth
  authStatus: () => invoke('auth:status'),
  login: () => invoke('auth:login'),
  cancelLogin: () => invoke('auth:cancel'),
  logout: () => invoke('auth:logout'),
  getAccessToken: () => invoke<string>('auth:token'),

  // Settings
  getSettings: () => invoke('settings:get'),
  setSettings: (patch: Record<string, unknown>) => invoke('settings:set', patch),

  // Platform
  appInfo: () => invoke('app:info'),
  artwork: (url: string) => invoke<string>('img:get', url),
  openExternal: (url: string) => invoke('shell:openExternal', url),
  updateCheck: () => invoke('update:check'),

  // Window chrome
  window: (action: 'minimize' | 'toggleMaximize' | 'close') => invoke('window:control', action),

  // Tray mini-player state (main enqueues menu refresh)
  trayState: (state: { isPlaying: boolean; title: string; artists: string }) =>
    invoke('tray:update', state),

  // Events from main
  onTrayAction(callback: (action: 'togglePlay' | 'next' | 'prev' | 'quit') => void): () => void {
    const listener = (_e: Electron.IpcRendererEvent, action: 'togglePlay' | 'next' | 'prev' | 'quit') => callback(action)
    ipcRenderer.on('player:tray-action', listener)
    return () => ipcRenderer.removeListener('player:tray-action', listener)
  }
}

contextBridge.exposeInMainWorld('attune', bridge)
