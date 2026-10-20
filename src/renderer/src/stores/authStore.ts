import { create } from 'zustand'
import type { AuthStatus } from '../../../preload/index.d'
import type { AttuneSettings } from '../../../preload/index.d'

export type AuthPhase = 'unknown' | 'setup' | 'signed-out' | 'signed-in'

interface AuthStoreData {
  phase: AuthPhase
  clientIdSet: boolean
  redirectUri: string
  encryptionAvailable: boolean
  pendingLogin: boolean
  loginError: string | null
  /** Non-null when the signed-in state was lost (e.g. token revoked elsewhere). */
  sessionError: string | null
  lastActivity: number

  init(): Promise<void>
  login(clientId?: string): Promise<void>
  cancelLogin(): Promise<void>
  logout(): Promise<void>
  markSignedOut(reason: 'revoked' | 'signed-out'): void
  touch(): void
}

export const useAuthStore = create<AuthStoreData>((set, get) => ({
  phase: 'unknown',
  clientIdSet: false,
  redirectUri: 'http://127.0.0.1:52331/callback',
  encryptionAvailable: true,
  pendingLogin: false,
  loginError: null,
  sessionError: null,
  lastActivity: Date.now(),

  async init() {
    const status: AuthStatus = await window.attune.authStatus()
    set({
      phase: status.loggedIn ? 'signed-in' : status.clientIdSet ? 'signed-out' : 'setup',
      clientIdSet: status.clientIdSet,
      redirectUri: status.redirectUri,
      encryptionAvailable: status.encryptionAvailable,
      sessionError: get().sessionError
    })
  },

  async login(clientId) {
    if (clientId) {
      await window.attune.setSettings({ clientId } as Partial<AttuneSettings>)
      set({ clientIdSet: true })
    }
    set({ pendingLogin: true, loginError: null, sessionError: null })
    try {
      await window.attune.login()
      await get().init()
      // engine is imported dynamically to avoid a synchronous module cycle.
      const { playerEngine } = await import('../player/engine')
      await playerEngine.startPollingAfterLogin()
    } catch (err) {
      set({ loginError: err instanceof Error ? err.message : 'Login failed.' })
      await get().init()
    } finally {
      set({ pendingLogin: false })
    }
  },

  async cancelLogin() {
    await window.attune.cancelLogin()
    set({ pendingLogin: false })
  },

  async logout() {
    await window.attune.logout()
    const { playerEngine } = await import('../player/engine')
    playerEngine.stopPolling()
    const { queryClient } = await import('../lib/queryClient')
    queryClient.clear()
    set({ phase: 'signed-out', sessionError: null })
  },

  markSignedOut(reason) {
    void (async () => {
      const { playerEngine } = await import('../player/engine')
      playerEngine.stopPolling()
      const { queryClient } = await import('../lib/queryClient')
      queryClient.clear()
      set({
        phase: 'signed-out',
        sessionError: reason === 'revoked' ? 'Your Spotify session expired or was revoked. Please sign in again.' : null
      })
    })()
  },

  touch() {
    set({ lastActivity: Date.now() })
  }
}))
