import { shell } from 'electron'
import { LoopbackAuthServer } from './loopback'
import { createPkcePair, randomState } from './pkce'
import type { StoredTokens, TokenVault } from './vault'
import type { Settings } from '../settings'

const AUTHORIZE_URL = 'https://accounts.spotify.com/authorize'
const TOKEN_URL = 'https://accounts.spotify.com/api/token'

export const SPOTIFY_SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-library-read',
  'user-library-modify',
  'user-top-read',
  'user-read-recently-played'
].join(' ')

export interface TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token?: string
  scope: string
}

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: 'no-client-id' | 'not-signed-in' | 'token-revoked' | 'encryption-unavailable' | 'login-in-progress'
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

export class SpotifyAuthFlow {
  private loginServer: LoopbackAuthServer | null = null
  private loginInFlight: Promise<void> | null = null
  private refreshInFlight: Promise<string> | null = null

  constructor(
    private readonly vault: TokenVault,
    private readonly settings: Settings
  ) {}

  get redirectUri(): string {
    return `http://127.0.0.1:${this.settings.get('authPort')}/callback`
  }

  hasTokens(): boolean {
    return this.vault.load() !== null
  }

  /** Opens the system browser and waits for the loopback callback to deliver the code. */
  async login(): Promise<void> {
    if (this.loginInFlight) return this.loginInFlight
    this.loginInFlight = (async () => {
      const clientId = this.settings.get('clientId')
      if (!clientId) throw new AuthError('Add your Spotify Client ID first (Settings).', 'no-client-id')
      if (!this.vault.isEncryptionAvailable()) {
        throw new AuthError('OS secure storage unavailable; cannot sign in safely.', 'encryption-unavailable')
      }

      const { verifier, challenge } = createPkcePair()
      const state = randomState()
      const url = new URL(AUTHORIZE_URL)
      url.searchParams.set('client_id', clientId)
      url.searchParams.set('response_type', 'code')
      url.searchParams.set('redirect_uri', this.redirectUri)
      url.searchParams.set('code_challenge_method', 'S256')
      url.searchParams.set('code_challenge', challenge)
      url.searchParams.set('state', state)
      url.searchParams.set('scope', SPOTIFY_SCOPES)

      try {
        const server = new LoopbackAuthServer()
        this.loginServer = server
        const port = this.settings.get('authPort')
        const started = server.start(port, state)
        await shell.openExternal(url.toString())
        const { code } = await started
        const tokens = await this.exchangeToken(clientId, code, verifier)
        this.saveTokens(tokens)
      } finally {
        this.loginServer?.close()
        this.loginServer = null
        this.loginInFlight = null
      }
    })()
    return this.loginInFlight
  }

  cancelLogin(): void {
    this.loginServer?.close()
    this.loginServer = null
  }

  logout(): void {
    this.cancelLogin()
    this.vault.clear()
  }

  /** Returns a fresh access token (refreshes proactively when near expiry). Single-flight. */
  async freshAccessToken(): Promise<string> {
    void this.refreshIfDue()
    const tokens = this.vault.load()
    if (!tokens) throw new AuthError('Not signed in.', 'not-signed-in')
    if (Date.now() < tokens.accessTokenExpiresAt - 30_000) return tokens.accessToken
    return this.refresh(tokens)
  }

  /** Fire-and-forget proactive refresh on app launch / timer; resolves 'done' | 'noop'. */
  async refreshIfDue(): Promise<'done' | 'noop'> {
    const tokens = this.vault.load()
    if (!tokens) return 'noop'
    if (Date.now() < tokens.accessTokenExpiresAt - 60_000) return 'noop'
    await this.refresh(tokens).catch(() => undefined)
    return 'done'
  }

  private refresh(tokens: StoredTokens): Promise<string> {
    if (this.refreshInFlight) return this.refreshInFlight
    this.refreshInFlight = (async () => {
      try {
        const clientId = this.settings.get('clientId')
        if (!clientId) throw new AuthError('Missing Client ID. Re-enter it in Settings.', 'no-client-id')
        const body = new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: tokens.refreshToken,
          client_id: clientId
        })
        const response = await fetch(TOKEN_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body
        })
        if (response.status === 400 || response.status === 401) {
          // Spotify may respond 400 invalid_grant on refresh-token revocation: session is gone.
          this.vault.clear()
          throw new AuthError('Session expired. Please sign in again.', 'token-revoked')
        }
        if (!response.ok) {
          throw new Error(`Token refresh failed (${response.status}).`)
        }
        const data = (await response.json()) as TokenResponse
        const updated: StoredTokens = {
          accessToken: data.access_token,
          refreshToken: data.refresh_token ?? tokens.refreshToken,
          accessTokenExpiresAt: Date.now() + data.expires_in * 1000,
          scope: data.scope ?? tokens.scope
        }
        this.vault.save(updated)
        return updated.accessToken
      } finally {
        this.refreshInFlight = null
      }
    })()
    return this.refreshInFlight
  }

  /** Token exchange per RFC 7636 with client_id (no client secret for desktop apps). */
  private async exchangeToken(clientId: string, code: string, verifier: string): Promise<TokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri,
      client_id: clientId,
      code_verifier: verifier
    })
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body
    })
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      let detail = ''
      try {
        detail = (JSON.parse(text) as { error_description?: string }).error_description ?? ''
      } catch { /* raw body */ }
      throw new Error(`Token exchange failed (${response.status}). ${detail}`.trim())
    }
    return (await response.json()) as TokenResponse
  }

  /** Persists tokens; on re-auth Spotify may omit refresh_token — keep the previous one then. */
  private saveTokens(data: TokenResponse, previous?: StoredTokens | null): void {
    const refreshToken = data.refresh_token ?? previous?.refreshToken ?? ''
    this.vault.save({
      accessToken: data.access_token,
      refreshToken,
      accessTokenExpiresAt: Date.now() + data.expires_in * 1000,
      scope: data.scope
    })
  }
}

