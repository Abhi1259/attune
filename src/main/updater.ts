import { app } from 'electron'
import { autoUpdater } from 'electron-updater'

/**
 * Auto-update wiring (Windows/Linux; macOS updates require signed builds and
 * stay manual for the unsigned personal v1).
 *
 * Enabled when the app is packaged AND a publish target has been configured in
 * electron-builder.yml (GitHub Releases). In development this is a no-op.
 */
export function setupAutoUpdater(): void {
  if (!app.isPackaged) return
  try {
    autoUpdater.autoDownload = true
    autoUpdater.on('update-available', () => console.log('[updater] update available'))
    autoUpdater.on('update-downloaded', () => {
      // Simple policy for v1: prompt-free, installs on next restart.
      console.log('[updater] update downloaded; installs on restart')
    })
    autoUpdater.on('error', (err) => console.warn('[updater] error:', err))
    // Delayed check so first paint is never blocked on update traffic.
    setTimeout(() => {
      void autoUpdater.checkForUpdates().catch((err: { message?: string }) => {
        console.warn('[updater] check failed (is the publish repo configured?):', err?.message ?? err)
      })
    }, 30_000)
  } catch (err) {
    console.warn('[updater] init failed:', err)
  }
}

export function runUpdatorCheck(): { ran: boolean } {
  if (!app.isPackaged) return { ran: false }
  void autoUpdater.checkForUpdates().catch(() => undefined)
  return { ran: true }
}
