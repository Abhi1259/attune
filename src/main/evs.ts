/**
 * castlabs Electron detection.
 *
 * The castlabs build ships a Widevine CDM inside the binary (versions like
 * "36.2.1+wvcus"), which is what lets Spotify's Web Playback SDK stream full
 * tracks inside this app. Detection is used to gate in-app streaming mode and
 * to surface diagnostics in Settings.
 *
 * EVS license verification: castlabs issues per-app EVS licenses for Widevine
 * playback. During development the CDM typically behaves without extra
 * verification; for signed public distribution a prod EVS license must be
 * applied for and verified per castlabs' instructions.
 * See docs/SETUP.md ("castlabs EVS") for the exact steps.
 */
export function isCastlabsElectron(): boolean {
  const marker = process.versions.electron ?? ''
  return marker.includes('+wv') || marker.includes('wvcus')
}

export function electronBuildLabel(): string {
  return process.versions.electron ?? 'unknown'
}
