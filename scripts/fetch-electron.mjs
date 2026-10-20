#!/usr/bin/env node
/**
 * Replaces the standard Electron binary in node_modules/electron/dist with the
 * castlabs Electron build ("wvcus" variant), which bundles the Widevine CDM
 * required by Spotify's Web Playback SDK for full-track playback.
 *
 * Usage: node scripts/fetch-electron.mjs [variant] [version]
 *   variant defaults to 'wvcus'; version defaults to the pinned electron in package.json.
 *
 * Skips automatically if env ATTUNE_ELECTRON=none or if the castlabs build is
 * already installed (see node_modules/electron/attune.electron.json marker).
 * On failure it exits 0 with a warning so normal (non-Widevine) development still works.
 */
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const electronDir = path.join(root, 'node_modules', 'electron')
const distDir = path.join(electronDir, 'dist')

if (process.env.ATTUNE_ELECTRON === 'none') {
  console.log('[fetch-electron] ATTUNE_ELECTRON=none, keeping stock electron')
  process.exit(0)
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'))
const pinned = pkg.devDependencies?.electron ?? ''
const baseVersion = process.argv[3] || pinned
const variant = process.argv[2] || 'wvcus'

if (!baseVersion) {
  console.warn('[fetch-electron] no electron version pinned in package.json; skipping')
  process.exit(0)
}

const markerFile = path.join(electronDir, 'attune.electron.json')
try {
  const marker = JSON.parse(fs.readFileSync(markerFile, 'utf-8'))
  if (marker.castlabs === variant && marker.version === `${variant}-v${baseVersion}` && fs.existsSync(distDir)) {
    console.log(`[fetch-electron] castlabs ${variant} v${baseVersion} already installed, nothing to do`)
    process.exit(0)
  }
} catch {
  /* first run */
}

const platformTag = { win32: 'win32', darwin: 'darwin', linux: 'linux' }[process.platform]
const archTag = { x64: 'x64', arm64: 'arm64', armv7l: 'arm' }[process.arch]
if (!platformTag || !archTag) {
  console.warn(`[fetch-electron] unsupported platform ${process.platform}/${process.arch}; skipping`)
  process.exit(0)
}

// castlabs release layout: tag "v36.2.1+wvcus", asset "electron-v36.2.1+wvcus-win32-x64.zip"
const version = `${baseVersion}+${variant}`
const releaseTag = `v${version}`
const assetName = `electron-v${version}-${platformTag}-${archTag}.zip`
const baseUrl = `https://github.com/castlabs/electron-releases/releases/download/${releaseTag}`
const zipUrl = `${baseUrl}/${assetName}`
const shasumsUrl = `${baseUrl}/SHASUMS256.txt`

console.log(`[fetch-electron] downloading ${assetName} (~150 MB)`)
const zipRes = await fetch(zipUrl, { redirect: 'follow' })
if (zipRes.status === 404) {
  console.warn(
    `[fetch-electron] no castlabs release asset for ${releaseTag} (${assetName}).\n` +
    'Check available variants at https://github.com/castlabs/electron-releases/releases\n' +
    'Falling back to stock electron (in-app streaming will be unavailable).'
  )
  process.exit(0)
}
if (!zipRes.ok || !zipRes.body) {
  console.warn(`[fetch-electron] download failed: HTTP ${zipRes.status}; falling back to stock electron`)
  process.exit(0)
}
const zipBuffer = Buffer.from(await zipRes.arrayBuffer())

// Verify against the release SHASUMS when available. Never install an unverified build.
try {
  const shaRes = await fetch(shasumsUrl, { redirect: 'follow' })
  if (shaRes.ok) {
    const lines = (await shaRes.text()).split(/\r?\n/)
    const entry = lines.find((l) => l.endsWith(assetName))
    if (!entry) throw new Error('asset not listed')
    const expected = entry.split(' ')[0]?.toLowerCase()
    const actual = createHash('sha256').update(zipBuffer).digest('hex')
    if (actual !== expected) throw new Error(`sha mismatch (expected ${expected}, got ${actual})`)
    console.log('[fetch-electron] sha256 verified against castlabs SHASUMS256.txt')
  } else {
    throw new Error(`SHASUMS fetch failed (HTTP ${shaRes.status})`)
  }
} catch (err) {
  console.warn(`[fetch-electron] could not verify download (${err.message}); aborting, keeping stock electron`)
  process.exit(0)
}

fs.rmSync(distDir, { recursive: true, force: true })
fs.mkdirSync(distDir, { recursive: true })
const tmpZip = path.join(root, 'cache', assetName)
fs.mkdirSync(path.dirname(tmpZip), { recursive: true })
fs.writeFileSync(tmpZip, zipBuffer)

function unzip(zip, dest) {
  if (process.platform === 'win32') {
    const r = spawnSync('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-Command',
      `Expand-Archive -LiteralPath '${zip}' -DestinationPath '${dest}' -Force`
    ], { stdio: 'inherit' })
    if (r.status !== 0) throw new Error(`Expand-Archive exited ${r.status}`)
  } else if (process.platform === 'darwin') {
    const r = spawnSync('/usr/bin/ditto', ['-x', '-k', zip, dest], { stdio: 'inherit' })
    if (r.status !== 0) throw new Error(`ditto exited ${r.status}`)
  } else {
    const r = spawnSync('unzip', ['-oq', zip, '-d', dest], { stdio: 'inherit' })
    if (r.status !== 0) throw new Error(`unzip exited ${r.status}`)
  }
}

try {
  unzip(tmpZip, distDir)
} catch (err) {
  console.warn(`[fetch-electron] unzip failed: ${err.message}`)
  process.exit(0)
}

// marker so reruns are no-ops
fs.writeFileSync(markerFile, JSON.stringify({ castlabs: variant, version, installedAt: new Date().toISOString() }, null, 2))

try { fs.rmSync(tmpZip, { force: true }) } catch { /* ignore */ }
console.log(`[fetch-electron] castlabs Electron ${version} (${variant}) installed into ${path.relative(root, distDir)}`)
