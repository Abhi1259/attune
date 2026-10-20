import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuthStore } from '../stores/authStore'
import { useSettingsStore } from '../stores/settingsStore'
import { playerEngine } from '../player/engine'
import { Button, Spinner, TextInput, Toggle, SectionHeader, cx } from '../components/ui'
import type { AttuneSettings } from '../../../preload/index.d'

type ThemeMode = AttuneSettings['themeMode']

const THEMES: { id: ThemeMode; label: string }[] = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' }
]

export function SettingsView() {
  const settings = useSettingsStore((s) => s.settings)
  const appInfo = useSettingsStore((s) => s.appInfo)
  const clientIdSet = useAuthStore((s) => s.clientIdSet)
  const redirectUri = useAuthStore((s) => s.redirectUri)

  const me = useQuery({ queryKey: ['me'], queryFn: api.me, staleTime: 10 * 60_000 })

  const [deviceNameDraft, setDeviceNameDraft] = useState(settings?.deviceName ?? 'Attune')
  const [clientIdDraft, setClientIdDraft] = useState('')
  const [replacingId, setReplacingId] = useState(false)

  if (!settings) {
    return <div className="grid place-items-center py-24"><Spinner /></div>
  }

  const update = (patch: Partial<AttuneSettings>) => void useSettingsStore.getState().update(patch)

  const replaceClientId = async () => {
    const trimmed = clientIdDraft.trim()
    if (!/^[0-9a-f]{32}$/i.test(trimmed)) return
    await window.attune.setSettings({ clientId: trimmed })
    setClientIdDraft('')
    setReplacingId(false)
    // Tokens are minted per client id; sign out so the next login starts clean.
    await useAuthStore.getState().logout()
  }

  return (
    <div className="att-fade-in mx-auto flex flex-col gap-9 px-8 py-6 pb-16" style={{ maxWidth: 720 }}>
      <h1 className="text-xl font-bold tracking-tight text-ink">Settings</h1>

      <section>
        <SectionHeader title="Account" />
        <div className="flex items-center justify-between rounded-card border border-line bg-surface p-4">
          <div>
            <p className="text-sm font-medium text-ink">{me.isLoading ? 'Loading…' : me.data?.display_name ?? 'Spotify user'}</p>
            <p className="text-xs text-ink-muted">Signed in to Spotify with this app's dev credentials.</p>
          </div>
          <Button variant="outline" onClick={() => void useAuthStore.getState().logout()}>
            Sign out
          </Button>
        </div>
      </section>

      <section>
        <SectionHeader title="Appearance" />
        <div className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink">Theme</span>
            <div className="flex items-center gap-1" role="radiogroup" aria-label="Theme">
              {THEMES.map(({ id, label }) => (
                <button
                  key={id}
                  role="radio"
                  aria-checked={settings.themeMode === id}
                  onClick={() => update({ themeMode: id })}
                  className={cx(
                    'rounded px-3 py-1.5 text-xs font-medium transition-colors',
                    settings.themeMode === id ? 'bg-elevated text-ink' : 'text-ink-muted hover:bg-elevated hover:text-ink'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-ink">Accent from album art</p>
              <p className="text-xs text-ink-muted">Tint controls with the current cover color.</p>
            </div>
            <Toggle
              checked={settings.useArtAccent}
              onChange={(v) => update({ useArtAccent: v })}
              label="Accent from album art"
            />
          </div>
        </div>
      </section>

      <section>
        <SectionHeader title="Playback" />
        <div className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-ink">Device name</p>
              <p className="text-xs text-ink-muted">Shown in Spotify Connect lists and the tray.</p>
            </div>
            <TextInput
              className="w-48"
              value={deviceNameDraft}
              onChange={(e) => setDeviceNameDraft(e.target.value)}
              onBlur={() => {
                if (deviceNameDraft.trim() && deviceNameDraft !== settings.deviceName) {
                  update({ deviceName: deviceNameDraft.trim() })
                }
              }}
              aria-label="Device name"
              maxLength={32}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-ink">In-app streaming</p>
              <p className="text-xs text-ink-muted">
                Play full tracks inside Attune (castlabs Electron + Widevine + Premium).{' '}
                {appInfo?.castlabs ? 'This build supports it.' : 'This build does NOT include Widevine — remote control still works.'}
              </p>
            </div>
            <Toggle
              checked={settings.inAppStreaming}
              onChange={(v) => {
                update({ inAppStreaming: v })
                void playerEngine.applyStreamingSetting()
              }}
              label="In-app streaming"
            />
          </div>
        </div>
      </section>

      <section>
        <SectionHeader title="Spotify app credentials" />
        <div className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
          <div>
            <p className="text-sm text-ink">Redirect URI</p>
            <p className="mt-0.5 text-xs text-ink-muted selectable">
              Must appear in your app's settings at{' '}
              <button
                className="underline decoration-line underline-offset-2 hover:decoration-ink"
                onClick={() => void window.attune.openExternal('https://developer.spotify.com/dashboard')}
              >
                developer.spotify.com/dashboard
              </button>
              .
            </p>
            <code className="mt-1.5 inline-block rounded bg-base px-2 py-1 text-[12px] text-ink">{redirectUri}</code>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-ink">Client ID</p>
              <p className="text-xs text-ink-muted">
                {clientIdSet ? 'Configured (hidden for safety). Replacing it signs you out.' : 'Not configured yet.'}
              </p>
            </div>
            {replacingId ? (
              <div className="flex items-center gap-2">
                <TextInput
                  className="w-56"
                  placeholder="Client ID"
                  value={clientIdDraft}
                  onChange={(e) => setClientIdDraft(e.target.value)}
                  aria-label="New client ID"
                />
                <Button variant="primary" onClick={() => void replaceClientId()}>
                  Save
                </Button>
                <Button variant="ghost" onClick={() => setReplacingId(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button variant="outline" onClick={() => setReplacingId(true)}>
                Replace
              </Button>
            )}
          </div>
        </div>
      </section>

      <section>
        <SectionHeader title="About" />
        <div className="flex flex-col gap-1.5 rounded-card border border-line bg-surface p-4 text-xs text-ink-muted">
          <p className="selectable">Attune {appInfo?.appVersion ?? 'dev'} · {appInfo?.platform ?? '?'}</p>
          <p className="selectable">Electron {appInfo?.electronVersion} {appInfo?.castlabs ? '(castlabs / Widevine)' : '(no Widevine: stock build)'}</p>
          <p className="text-ink-faint">Personal build. Streams via the official Spotify Web API + Web Playback SDK; no ad-defeating features.</p>
          <div className="mt-1">
            <Button variant="ghost" onClick={() => void window.attune.updateCheck()}>
              Check for updates
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
