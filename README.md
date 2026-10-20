# Attune

A minimal, personal Spotify desktop player for Windows, macOS and Linux.

Electron (castlabs Widevine build) + React + TypeScript + Tailwind. Streams full tracks **in-app** through the official Spotify Web Playback SDK, doubles as a Spotify Connect remote, and browses your library — without pretending to be the Spotify client.

![status](https://img.shields.io/badge/status-personal%20v1-blue)

## What it does

- **Full playback in-app** — Widevine DRM streaming via the Web Playback SDK (requires Spotify Premium, like every third-party Spotify client).
- **Spotify Connect remote** — pick any of your Spotify devices (phone, speaker, desktop Spotify) and control playback; or make *Attune* itself the target device.
- **Library** — liked songs, saved albums, playlists (yours and followed), albums, artist discography, top tracks/artists, recently played, search.
- **Queue panel** plus standard transport (play/pause/seek/next/prev/shuffle/repeat/volume), tray controls, Windows/macOS media keys via MediaSession.
- **Free-account mode** — browse/search/save work without Premium, and audio can play through the official Spotify embed player (Spotify's own ad/preview rules apply there — Attune never bypasses them). The player bar shows a *free account* chip with an embed shortcut.
- **Clean UI** — light/dark/system theme, auto accent color extracted from the current album art, collapsed/expanded sidebar.

## What it deliberately does not do

- **No 30-second previews.** Spotify shut the preview endpoints down (Feb 2026 rules); instead of degraded playback you get a clear "Premium required" state.
- **No ad-defeating features.** No stripped ads, no hidden endpoints — this uses only the official Web API + Web Playback SDK and is meant as a personal client for your own dev-mode app.
- **No client IDs in source.** You paste *your* Spotify app's Client ID on first launch; it is stored locally, encrypted.

## Requirements

- **Spotify Premium** (any third-party SDK playback requires Premium)
- Your own **Spotify app registered in the developer dashboard** in *dev mode* — Feb 2026 rules apply: Web API/Web Playback SDK access for the registered redirect only, max 5 users, no extended quota, no `preview_url`, no `country`/`product`/`email` on `GET /me` (premium state is detected via 403s + SDK `account_error` instead).
- Node.js 20+, npm 11+ (install-script allowlist used: `electron`, `esbuild`), git
- A castlabs Electron build for Widevine (fetched automatically — see below)

## Quick start

```bash
npm install
npm run electron:fetch   # installs castlabs Electron 36.x +wvcus (Widevine), verifies SHA-256
npm run dev              # first run opens the setup screen: paste your Client ID, then sign in
```

Before `dev` works, register the redirect URI in your Spotify dashboard — exact steps in [docs/SETUP.md](docs/SETUP.md). Summary:

> https://developer.spotify.com/dashboard → your app → *Edit* → Redirect URIs → add exactly
>
> ```
> http://127.0.0.1:52331/callback
> ```

(`localhost` and nonstandard ports are rejected by Spotify; the loopback server binds to fixed port **52331**.)

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run the app with HMR (renderer) |
| `npm run build` | Production build of main/preload/renderer to `out/` |
| `npm run typecheck` | `tsc` over node + web configs |
| `npm test` | vitest (PKCE + loopback server) |
| `npm run smoke` | Boots the real Electron app headless; prints `SMOKE_OK` |
| `npm run electron:fetch` | Downloads castlabs Electron (attune-pinned version) into `node_modules/electron/dist` |
| `npm run icons` | Regenerates `build/icon.*` + `build/tray.png` |
| `npm run dist:win` | Windows NSIS installer (unsigned for personal v1) |
| `npm run dist:linux` | Linux AppImage/deb |
| `npm run dist:mac` | macOS dmg (ad-hoc unsigned) |

## Architecture map

```
src/
├── main/                  # Electron main process
│   ├── auth/              # PKCE pair, loopback callback server (fixed port), token vault, single-flight refresh
│   ├── settings/          # typed settings file beside the vault
│   ├── evs.ts             # castlabs EVS license check for Widevine
│   ├── imageProxy.ts      # artwork fetched in main, bounded in-memory TTL cache, data URLs (canvas-safe for accent sampling)
│   ├── tray.ts            # tray icon + play/pause menu
│   ├── updater.ts         # electron-updater (dormant until signed builds / GitHub Releases)
│   └── index.ts           # window, CSP (packaged only), IPC: auth:*, settings:*, img:get, tray:update, window:*, update:check
├── preload/               # contextIsolated bridge — window.attune (typed in preload/index.d.ts)
└── renderer/src/
    ├── lib/               # tiny typed Web API client (Feb-2026 surface), artwork cache, accent extraction, theme
    ├── stores/            # zustand: auth phases, persisted settings
    ├── player/            # engine: token boot, Web Playback SDK load, MediaSession, device fallback, queue
    ├── hooks/             # infinite paginated lists, saved-state heart with presets
    ├── components/        # TrackList, MediaCard/grid, sliders, device picker, queue panel, player bar...
    └── views/             # Login, Home, Search, Playlists(+detail), Liked/Saved albums, Album/Artist, Top, Recent, NowPlaying, Settings
```

## Security model

- Tokens live **only** in `%APPDATA%/Attune/attune.vault`, encrypted with Electron `safeStorage` (OS-level: DPAPI on Windows). Log out = vault delete.
- Renderer is sandboxed; `contextIsolation: true`; narrow `window.attune` bridge.
- CSP is injected in **packaged** builds only (dev stays relaxed for Vite HMR). Artwork loads through the main-process proxy with an in-memory cache (`img:get` → data URLs); the only remote script allowed is the Web Playback SDK (`sdk.scdn.co`).
- No telemetry, no analytics, nothing leaves your machine except Spotify API/image calls.

## Packaging notes (unsigned personal v1)

Installers are **unsigned** — SmartScreen/Gatekeeper warnings are expected; click through locally. `electron-updater` stays disabled until the app has a GitHub Releases target and (eventually) signing certs. Widevine streaming inside a packaged app additionally relies on the castlabs EVS-licensed build — verify with the EVS diagnostics in `docs/SETUP.md`.

**Windows dev note:** electron-builder's first run tries to extract `winCodeSign` symlinks, which needs Developer Mode or admin. If extraction fails, pre-seed `%LOCALAPPDATA%\electron-builder\Cache\winCodeSign\winCodeSign-2.6.0` (extract the `.7z` from the cache dir with 7-Zip, the two failing files are darwin-only symlinks, safe to skip).

## License

Personal-use reference application. Spotify trademarks/data belong to Spotify; you are bound by the Spotify Developer Terms when creating your own Client ID.
