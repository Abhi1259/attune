import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import { useSettingsStore } from './stores/settingsStore'
import { usePlayer } from './player/store'
import { playerEngine } from './player/engine'
import { applyArtAccent } from './lib/accentRuntime'
import { Titlebar } from './components/Titlebar'
import { Sidebar } from './components/Sidebar'
import { PlayerBar } from './components/PlayerBar'
import { EmbedPanel } from './components/EmbedPanel'
import { HomeView } from './views/Home'
import { SearchView } from './views/Search'
import { PlaylistsView, PlaylistDetailView } from './views/Playlists'
import { SavedTracksView, SavedAlbumsView } from './views/Library'
import { AlbumDetailView, ArtistDetailView } from './views/Catalog'
import { TopView } from './views/Top'
import { RecentlyPlayedView } from './views/RecentlyPlayed'
import { NowPlayingView } from './views/NowPlaying'
import { SettingsView } from './views/Settings'
import { LoginScreen } from './views/Login'
import { Spinner } from './components/ui'

export function App() {
  const phase = useAuthStore((s) => s.phase)
  const settings = useSettingsStore((s) => s.settings)
  const appInfo = useSettingsStore((s) => s.appInfo)
  const artUrl = usePlayer((s) => s.snapshot?.track?.album?.images?.[0]?.url ?? null)

  // Bootstrap stores once; the engine's listeners are registered in main.tsx.
  useEffect(() => {
    void (async () => {
      await useSettingsStore.getState().load()
      await useAuthStore.getState().init()
      // On restart with a stored session: polling starts here, not from login().
      if (useAuthStore.getState().phase === 'signed-in') {
        void playerEngine.startPollingAfterLogin()
      }
    })()
  }, [])

  // Album-art accent follows the playing track + the settings toggle.
  useEffect(() => {
    void applyArtAccent(artUrl, settings?.useArtAccent ?? true)
  }, [artUrl, settings?.useArtAccent])

  if (phase === 'unknown') {
    return (
      <div className="grid h-full place-items-center bg-base">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  if (phase !== 'signed-in') {
    return <LoginScreen />
  }

  const isMac = appInfo?.platform === 'darwin'

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {!isMac && <Titlebar />}
      {isMac && <div className="h-9 shrink-0" aria-hidden />}
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="att-scroll min-w-0 flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<HomeView />} />
            <Route path="/search" element={<SearchView />} />
            <Route path="/playlists" element={<PlaylistsView />} />
            <Route path="/playlists/:playlistId" element={<PlaylistDetailView />} />
            <Route path="/saved-tracks" element={<SavedTracksView />} />
            <Route path="/saved-albums" element={<SavedAlbumsView />} />
            <Route path="/album/:albumId" element={<AlbumDetailView />} />
            <Route path="/artist/:artistId" element={<ArtistDetailView />} />
            <Route path="/top" element={<TopView />} />
            <Route path="/recently-played" element={<RecentlyPlayedView />} />
            <Route path="/now-playing" element={<NowPlayingView />} />
            <Route path="/settings" element={<SettingsView />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
      <EmbedPanel />
      <PlayerBar />
      <ErrorToasts />
    </div>
  )
}

/** Transient toast for engine-surfaced errors (no dependencies, minimal markup). */
function ErrorToasts() {
  const lastError = usePlayer((s) => s.lastError)
  useEffect(() => {
    if (!lastError) return
    const t = setTimeout(() => usePlayer.getState().setLastError(null), 4200)
    return () => clearTimeout(t)
  }, [lastError])

  if (!lastError) return null
  return (
    <div
      role="status"
      className="att-fade-in fixed bottom-[96px] left-1/2 z-50 -translate-x-1/2 rounded border border-line bg-elevated px-4 py-2 text-xs text-ink shadow-sm"
    >
      {lastError.message}
    </div>
  )
}
