import { useState } from 'react'
import { ExternalLink, Copy, Check, KeyRound, LogOut as LogOutIcon } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { Button, TextInput, EmptyState } from '../components/ui'
import { playerEngine } from '../player/engine'

const REDIRECT_HINT = 'http://127.0.0.1:52331/callback'

/** First-run / signed-out gate. Two steps when no Client ID is configured yet. */
export function LoginScreen() {
  const phase = useAuthStore((s) => s.phase)
  const clientIdSet = useAuthStore((s) => s.clientIdSet)
  const redirectUri = useAuthStore((s) => s.redirectUri)
  const encryptionAvailable = useAuthStore((s) => s.encryptionAvailable)
  const pendingLogin = useAuthStore((s) => s.pendingLogin)
  const loginError = useAuthStore((s) => s.loginError)
  const sessionError = useAuthStore((s) => s.sessionError)

  const [draftClientId, setDraftClientId] = useState('')
  const [copied, setCopied] = useState(false)
  const [invalid, setInvalid] = useState(false)

  const submitClientId = async () => {
    const trimmed = draftClientId.trim()
    if (!/^[0-9a-f]{32}$/i.test(trimmed)) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    await useAuthStore.getState().login(trimmed)
  }

  const copyRedirect = async () => {
    try {
      await navigator.clipboard.writeText(redirectUri)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard denied: user can select manually */
      void 0
    }
  }

  return (
    <div className="flex h-full items-center justify-center bg-base px-6">
      <div className="w-full max-w-md">
        <div className="mb-10 text-center">
          <div className="mb-4 inline-flex h-3 w-3 rounded-full" style={{ backgroundColor: 'var(--att-accent)' }} aria-hidden />
          <h1 className="text-3xl font-bold tracking-tight text-ink">Attune</h1>
          <p className="mt-2 text-sm text-ink-muted">A minimal desktop player for your Spotify account.</p>
        </div>

        {!encryptionAvailable && (
          <p className="mb-6 rounded border border-line bg-surface p-3 text-xs text-ink-muted">
            Your operating system's secure storage is unavailable, so Attune cannot store Spotify tokens encrypted. Sign-in is disabled for your safety.
          </p>
        )}

        {sessionError && (
          <p className="mb-6 rounded border border-line bg-surface p-3 text-xs text-ink-muted">{sessionError}</p>
        )}
        {loginError && (
          <p className="mb-6 rounded border border-line bg-surface p-3 text-xs text-ink-muted" role="alert">{loginError}</p>
        )}

        {!clientIdSet || phase === 'setup' ? (
          <div className="rounded-card border border-line bg-surface p-5">
            <div className="mb-4 flex items-center gap-2">
              <KeyRound size={16} className="text-ink-muted" />
              <h2 className="text-sm font-semibold text-ink">Connect your Spotify app</h2>
            </div>
            <ol className="mb-4 list-decimal space-y-1.5 pl-5 text-xs text-ink-muted">
              <li>
                Open the{' '}
                <button
                  className="inline-flex items-center gap-0.5 font-medium text-ink underline decoration-line underline-offset-2 hover:decoration-ink"
                  onClick={() => void window.attune.openExternal('https://developer.spotify.com/dashboard')}
                >
                  Spotify Developer Dashboard <ExternalLink size={10} />
                </button>{' '}
                and edit your app (or create one, enabling Web API).
              </li>
              <li>
                In <em>Redirect URIs</em>, add exactly{' '}
                <code className="ml-1 rounded bg-base px-1 py-0.5 text-[11px] text-ink">{redirectUri || REDIRECT_HINT}</code>
              </li>
              <li>Paste this app's Client ID below.</li>
            </ol>
            <TextInput
              value={draftClientId}
              onChange={(e) => setDraftClientId(e.target.value)}
              placeholder="32-character Client ID"
              spellCheck={false}
              autoComplete="off"
              aria-label="Spotify Client ID"
              className={invalid ? 'border-[#c0392b]' : undefined}
            />
            {invalid && <p className="mt-1.5 text-[11px] text-ink-muted">That doesn't look like a Spotify Client ID (32 hex characters).</p>}
            <Button variant="primary" className="mt-3 w-full" pending={pendingLogin} onClick={submitClientId}>
              Continue
            </Button>
          </div>
        ) : (
          <EmptyState
            title="Signed in to Spotify's developer portal?"
            hint="Attune opens your system browser; completing authorization connects this window."
            action={
              <Button variant="primary" pending={pendingLogin} onClick={() => void useAuthStore.getState().login()} className="mt-2">
                <span className="text-[13px]">Log in with Spotify</span>
              </Button>
            }
          />
        )}

        {pendingLogin && (
          <p className="mt-4 text-center text-xs text-ink-muted">
            Waiting for Spotify in your browser…{' '}
            <button className="underline hover:text-ink" onClick={() => void useAuthStore.getState().cancelLogin()}>
              Cancel
            </button>
          </p>
        )}

        <div className="mt-10 flex items-center justify-center gap-3 text-[11px] text-ink-faint">
          {(clientIdSet || redirectUri) && (
            <>
              <code className="max-w-[240px] truncate rounded bg-surface px-1.5 py-0.5">{redirectUri || REDIRECT_HINT}</code>
              <button onClick={() => void copyRedirect()} className="inline-flex items-center gap-1 hover:text-ink" aria-label="Copy redirect URI">
                {copied ? <Check size={11} /> : <Copy size={11} />} {copied ? 'Copied' : 'Copy'}
              </button>
              {clientIdSet && (
                <>
                  <span aria-hidden>·</span>
                  <button
                    className="inline-flex items-center gap-1 hover:text-ink"
                    onClick={() => {
                      void useAuthStore.getState().logout()
                      void playerEngine.stopPolling()
                    }}
                  >
                    <LogOutIcon size={11} /> Reset app
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
