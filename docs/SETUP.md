# Attune — Setup & First Run

Everything needed to get from `npm install` to playing a song in ~15 minutes.

---

## 1. Prerequisites

| Need | Why |
| --- | --- |
| Node.js **20+** / npm **11+** | Build toolchain (Vite 6, electron-vite 4) |
| Git | Versioning + future release automation |
| **Spotify Premium** | All third-party Spotify playback needs Premium — web playback and Connect targets alike |
| A Spotify developer app in **dev mode** | Feb 2026 rules: 1 client ID per personal app, ≤5 configured users, no extended quota, no deprecated preview endpoints |

---

## 2. Register your Spotify app (once)

1. Open <https://developer.spotify.com/dashboard> and sign in.
2. **Create app**
   - *App name*: `Attune` (any name works)
   - *Description*: brief; used only by the dashboard
   - *Which API/SDKs*: enable **Web API** and **Web Playback SDK**
   - *Target products*: Mobile / Desktop / Web (defaults are fine)
3. In the app page choose **Edit** → **Redirect URIs** and add **exactly**:

   ```
   http://127.0.0.1:52331/callback
   ```

   Requirements come straight from Spotify's policy:
   - `localhost` and `*.localhost` are **banned** — must be `127.0.0.1` (HTTP) or an HTTPS domain.
   - The port must match Attune's loopback listener: **52331** (fixed; editable only in source).
   - The whole string is compared exactly — no trailing content, no whitespace.
4. Save. Then copy your app's **Client ID** (32 hex chars). *You never need the Client Secret — Attune uses PKCE-only auth and never collects secrets.*

> Dev-mode note: until Spotify grants you extended access (rare for personal apps), **only your ≤5 configured dashboard users** can sign in through this client ID. Everyone else sees a 403 during login.

---

## 3. Install & provision Electron

```bash
git clone <your-repo> attune && cd attune
npm install
npm run install-scripts approve electron esbuild   # npm 11.19+ install-script allowlist
npm run electron:fetch                             # castlabs Electron + Widevine, SHA-256 verified
```

`npm run electron:fetch`:

- Reads `ELECTRON_VERSION = 36.2.1` out of `package.json` and pins the **castlabs** `+wvcus` flavor: `releases/download/v36.2.1+wvcus/electron-v36.2.1+wvcus-win32-x64.zip` (macOS/Linux variants equally supported).
- Verifies the zip against castlabs' `SHASUMS256.txt` **before** unpacking over `node_modules/electron/dist`. A marker (`node_modules/electron/attune.electron.json`) records what is installed so other tools (electron-builder) reuse it instead of redownloading.
- Diagnostics: `ATTUNE_ELECTRON=none` downloads stock Electron instead (fine for UI-only work, Widevine streaming then unavailable, Connect remote still works).

Why castlabs: only their build ships Widevine CDM loading + the EVS license plumbing that lets a manifest-less app activate DRM. Stock Electron cannot play Premium Spotify audio in-app.

---

## 4. First launch

```bash
npm run dev
```

1. The setup screen appears: **paste your Client ID**. It is stored *encrypted at rest* (Electron `safeStorage` → Windows DPAPI / macOS Keychain / Linux kwallet) in `attune.vault` next to your tokens — never compiled into source, never logged.
2. Press **Sign in** — the OAuth flow:
   - generates a PKCE verifier/challenge + random state,
   - opens the Spotify authorize page in your default browser,
   - answers on the loopback server at `http://127.0.0.1:52331/callback`,
   - verifies `state`, then exchanges the code without a client secret.
3. Approve the scopes. Attune launches into Home.

If the browser says `INVALID_CLIENT: Invalid redirect URI`, the dashboard string does not match §2 exactly — that is the only mismatch Attune cannot paper over.

---

## 5. Playback modes

| Mode | How to use | Where audio comes from |
| --- | --- | --- |
| **In-app** (castlabs) | Leave the in-app streaming toggle (Settings → Playback) on; press play | Attune itself is the Spotify device (Web Playback SDK inside Attune's window via Widevine/EVS) |
| **Connect remote** | Device picker in the player bar → choose your phone/speaker/desktop Spotify | Any of your Spotify devices |
| **Embed player (free accounts)** | Row ⋯-menu → *Play via Spotify embed*, or the embed button in the player bar | Spotify's official iframe player — tokenless, ad-supported; Spotify decides what full-plays vs preview-gates |

First in-app playback initializes Widevine (EVS activation) and can take a few seconds; subsequent runs are instant. Within Spotify apps, Attune lists itself under the name in Settings → "Device name" (default `Attune`).

Premium account errors surface as a clear *Premium required* state rather than preview clips (Spotify removed previews in early 2026, so there is no 30-second fallback to show).

---

## 6. Packaging

```bash
npm run dist:win            # NSIS installer → release/
npm run dist:win -- --dir   # unpacked tree at release/win-unpacked (no installer step)
```

- `electron-builder.yml` pins `electronDist: node_modules/electron/dist` so packaged builds ship the **castlabs** binary (stock Electron would break in-app streaming).
- v1 outputs are **unsigned**: SmartScreen/Gatekeeper will complain — expected for a personal build. Sign with your certificate and re-enable the winCodeSign/nsis flow before distributing to others.
- `electron-updater` is dormant: the `publish:` block is commented until the repo has GitHub Releases wired up.
- macOS needs `dist:mac` on a Mac (dmg target), ad-hoc signature only.

**First-run Windows cache gotcha:** electron-builder downloads `winCodeSign 2.6.0` and extracts symlinks — unprivileged extraction dies with
`Cannot create symbolic link : A required privilege is not held by the client`. It only matters for the 2 darwin `.dylib` symlinks. Either enable **Windows Developer Mode** / run once as admin, or pre-seed:

```powershell
$dest = "$env:LOCALAPPDATA\electron-builder\Cache\winCodeSign\winCodeSign-2.6.0"
mkdir $dest -Force
# extract the cached 7z (any variant of 7za x) into $dest; the two symlink errors are harmless
```

then re-run `dist:win` — the pre-extracted folder short-circuits the download.

---

## 7. Diagnostics & troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `SMOKE_OK` at boot (only when testing) | normal | Attune smoke-prints via `ATTUNE_SMOKE=1 node scripts/smoke.mjs` |
| DevTools for renderer debugging | optional | Run dev with `ATTUNE_OPEN_DEVTOOLS=1` |
| Login page spins forever | callback port already in use | Close any second Attune instance; port 52331 must be free (`netstat -ano \| findstr 52331`) |
| `INVALID_CLIENT` in browser | redirect URI mismatch | Recheck §2 — byte-for-byte `http://127.0.0.1:52331/callback` |
| "No Spotify device available" | no Connect target + no local player | Start playback on your phone once so it appears, or re-enable in-app streaming |
| `free account` chip in the player bar | signed in with a non-Premium account | Normal: browse/search/save work; use *Play via Spotify embed* (row ⋯ menu) for audio, or switch to a Premium account for in-app/Connect playback |
| 403 right after login | dev-mode user not registered | Add the signed-in account under dashboard *User Management* |
| `token-revoked` → auto sign-out | refresh token revoked server-side | Expected behavior: press **Sign in** again; the stored Client ID stays put |
| In-app streaming toggle gray (packaged) | no castlabs Electron / EVS failure | Confirm `node_modules/electron/attune.electron.json` exists; packaged app must contain the castlabs dist |
| Empty "Recently played" | Spotify only exposes the last 50 plays per account | Normal on fresh accounts |
| Library edits (save/unsave) silently failing | `PUT/DELETE /me/library?uris=` shape drift | API was current as of Feb 2026 — please open an issue if Spotify changed it |

Known API-shape shifts already handled defensively: playlist containers renamed `tracks` → `items`; `GET /me` no longer carries `country`/`product`/`email`; `/artists/{id}/top-tracks` is gone (discography + Connect targets are offered instead).

---

## 8. Privacy

- Everything sensitive lives in `userData/`: the encrypted vault (tokens + client ID). Artwork caches are in-memory for the session only. Delete the `userData/Attune` folder to fully reset the app.
- The only outbound traffic is Spotify API traffic (auth + described endpoints) and album-art CDNs (`i.scdn.co`). No tracking, no crash reporting.
