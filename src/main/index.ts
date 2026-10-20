import { app, BrowserWindow, ipcMain, nativeTheme, shell } from 'electron'
import path from 'node:path'
import { Settings, type AttuneSettings } from './settings'
import { AuthError, SpotifyAuthFlow } from './auth/authFlow'
import { TokenVault } from './auth/vault'
import { AttuneTray } from './tray'
import { fetchAsDataUrl } from './imageProxy'
import { isCastlabsElectron } from './evs'
import { runUpdatorCheck, setupAutoUpdater } from './updater'

/** SMTC (Windows) / MPRIS (Linux) / media-key plumbing for the renderer's mediaSession. */
app.commandLine.appendSwitch('enable-features', 'MediaSessionService')

if (!app.requestSingleInstanceLock()) {
  app.quit()
}

let mainWindow: BrowserWindow | null = null
let settings: Settings | null = null
let auth: SpotifyAuthFlow | null = null
let vault: TokenVault | null = null
let tray: AttuneTray | null = null

function createWindow(): BrowserWindow {
  const saved = settings?.all.window
  const isMac = process.platform === 'darwin'

  const win = new BrowserWindow({
    x: saved?.x,
    y: saved?.y,
    width: saved?.width ?? 1180,
    height: saved?.height ?? 780,
    minWidth: 960,
    minHeight: 620,
    show: false,
    title: 'Attune',
    backgroundColor: '#faf9f7',
    frame: isMac, // custom titlebar on win/linux (frameless); native traffic lights inset on macOS
    titleBarStyle: isMac ? 'hiddenInset' : undefined,
    trafficLightPosition: isMac ? { x: 16, y: 18 } : undefined,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  if (saved?.maximized) win.maximize()

  win.once('ready-to-show', () => {
    win.show()
    if (process.env.ATTUNE_SMOKE === '1') {
      console.log('SMOKE_OK')
      setTimeout(() => app.quit(), 300)
    }
  })

  const devUrl = process.env.ELECTRON_RENDERER_URL
  if (devUrl) {
    void win.loadURL(devUrl)
  } else {
    void win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  win.on('close', () => persistWindowBounds(win))

  // The app is a single-page UI; in-app navigation attempts get shut down so nothing can
  // hijack the window. External links open in the system browser via explicit IPC instead.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (event) => {
    event.preventDefault()
  })

  return win
}

function persistWindowBounds(win: BrowserWindow): void {
  if (!settings || win.isDestroyed()) return
  try {
    const bounds = win.getNormalBounds()
    settings.saveWindowState({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      maximized: win.isMaximized()
    })
  } catch (err) {
    console.warn('[attune] failed to persist window bounds:', err)
  }
}

function applyContentSecurityPolicy(win: BrowserWindow): void {
  // Packaged builds get a strict CSP; dev build stays relaxed for Vite HMR.
  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    if (!details.responseHeaders) return callback({ responseHeaders: details.responseHeaders ?? {} })
    const csp = [
      "default-src 'self'",
      "script-src 'self' https://sdk.scdn.co",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https: wss:",
      "media-src 'self' blob: https: mediastream:",
      "frame-src https:",
      "child-src https:",
      "worker-src 'self' blob:",
      "base-uri 'self'",
      "form-action 'none'"
    ].join('; ')
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp]
      }
    })
  })
}

const IPC_OK = <T>(data: T) => ({ ok: true as const, data })
const IPC_ERR = (err: unknown) => ({
  ok: false as const,
  error: err instanceof Error ? err.message : String(err),
  code: err instanceof AuthError ? err.code : undefined
})

function registerIpc(): void {
  ipcMain.handle('app:info', () => ({
    platform: process.platform,
    appVersion: app.getVersion(),
    electronVersion: process.versions.electron ?? 'unknown',
    castlabs: isCastlabsElectron()
  }))

  ipcMain.handle('settings:get', () => IPC_OK(settings?.all))
  ipcMain.handle('settings:set', (_e, patch: Partial<AttuneSettings>) => {
    if (!settings) return IPC_ERR(new Error('not ready'))
    const editable: Partial<AttuneSettings> = {}
    if (typeof patch.clientId === 'string') editable.clientId = patch.clientId.trim()
    const themes = ['system', 'light', 'dark'] as const
    const themeMode = themes.find((t) => t === patch.themeMode)
    if (themeMode) {
      editable.themeMode = themeMode
    }
    if (typeof patch.useArtAccent === 'boolean') editable.useArtAccent = patch.useArtAccent
    if (typeof patch.deviceName === 'string' && patch.deviceName.trim()) {
      editable.deviceName = patch.deviceName.trim().slice(0, 32)
    }
    if (typeof patch.inAppStreaming === 'boolean') editable.inAppStreaming = patch.inAppStreaming
    if (typeof patch.authPort === 'number' && patch.authPort >= 1024 && patch.authPort <= 65535) {
      editable.authPort = Math.floor(patch.authPort)
    }
    const next = settings.set(editable)
    if (themeMode) nativeTheme.themeSource = themeMode
    return IPC_OK(next)
  })

  ipcMain.handle('auth:status', () => {
    if (!auth || !settings || !vault) return IPC_ERR(new Error('not ready'))
    return IPC_OK({
      loggedIn: auth.hasTokens(),
      clientIdSet: Boolean(settings.get('clientId')),
      redirectUri: auth.redirectUri,
      encryptionAvailable: vault.isEncryptionAvailable()
    })
  })
  ipcMain.handle('auth:login', async () => {
    if (!auth) return IPC_ERR(new Error('not ready'))
    try {
      await auth.login()
      return IPC_OK(true)
    } catch (err) {
      return IPC_ERR(err)
    }
  })
  ipcMain.handle('auth:cancel', () => IPC_OK(Boolean(auth?.cancelLogin())))
  ipcMain.handle('auth:logout', () => IPC_OK(Boolean(auth?.logout())))

  ipcMain.handle('auth:token', async () => {
    if (!auth) return IPC_ERR(new Error('not ready'))
    try {
      const token = await auth.freshAccessToken()
      return IPC_OK(token)
    } catch (err) {
      return IPC_ERR(err)
    }
  })

  ipcMain.handle('img:get', async (_e, url: string) => {
    if (typeof url !== 'string' || !/^https:\/\//.test(url)) return IPC_ERR(new Error('invalid image url'))
    try {
      return IPC_OK(await fetchAsDataUrl(url))
    } catch (err) {
      return IPC_ERR(err)
    }
  })

  ipcMain.handle('tray:update', (_e, state: { isPlaying: boolean; title: string; artists: string }) => {
    tray?.update(state)
    return IPC_OK(true)
  })

  ipcMain.handle('window:control', (_e, action: 'minimize' | 'toggleMaximize' | 'close') => {
    const win = mainWindow
    if (!win) return IPC_ERR(new Error('no window'))
    if (action === 'minimize') win.minimize()
    else if (action === 'toggleMaximize') {
      if (win.isMaximized()) win.unmaximize()
      else win.maximize()
    } else if (action === 'close') win.close()
    return IPC_OK(true)
  })

  ipcMain.handle('update:check', () => IPC_OK(runUpdatorCheck()))
}

app.on('second-instance', () => {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.focus()
})

app.on('window-all-closed', () => {
  // Tray mini-player lives while the app runs; closing the window closes Attune.
  app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createWindow()
  }
})

app.on('before-quit', () => {
  if (mainWindow && !mainWindow.isDestroyed()) persistWindowBounds(mainWindow)
  auth?.cancelLogin()
  tray?.destroy()
})

app.whenReady().then(() => {
  settings = new Settings()
  vault = new TokenVault()
  auth = new SpotifyAuthFlow(vault, settings)
  nativeTheme.themeSource = settings.get('themeMode')

  mainWindow = createWindow()
  if (!process.env.ELECTRON_RENDERER_URL) applyContentSecurityPolicy(mainWindow)

  tray = new AttuneTray(
    () => {
      if (!mainWindow) return
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    },
    (action) => mainWindow?.webContents.send('player:tray-action', action)
  )

  registerIpc()
  setupAutoUpdater()

  // Some Spotify pages (artist bios, share links) come from the web: route them externally.
  ipcMain.handle('shell:openExternal', (_e, url: string) => {
    if (typeof url === 'string' && /^https:\/\//.test(url)) void shell.openExternal(url)
    return IPC_OK(true)
  })

  if (process.env.ATTUNE_SMOKE === '1' && BrowserWindow.getAllWindows().length === 0) {
    // protection against a race where the window factory exited early: quit loudly, no hang.
    console.log('SMOKE_FAIL_NO_WINDOW')
    app.quit()
  }
})
