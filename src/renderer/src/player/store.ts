import { create } from 'zustand'
import type { RepeatMode, SpotifyDevice, SpotifyTrack } from '../lib/types'

export interface Snapshot {
  track: SpotifyTrack | null
  contextUri: string | null
  isPlaying: boolean
  progressMs: number | null
  durationMs: number
  updatedAt: number
  shuffle: boolean
  repeat: RepeatMode
  source: 'server' | 'wps'
  deviceId: string | null
}

export interface InAppDeviceState {
  id: string | null
  status: 'off' | 'connecting' | 'ready' | 'error'
  error?: string
  widevine: boolean | null
}

interface PlayerStore {
  /** Null when nothing is playing anywhere (or state unknown yet). */
  snapshot: Snapshot | null
  /** Server polled but nothing is active anywhere. */
  idle: boolean
  devices: SpotifyDevice[]
  /** Chosen playback target; null = "follow whatever is/gets active" (prefers in-app when ready). */
  activeDeviceId: string | null
  inApp: InAppDeviceState
  volume: number
  queue: SpotifyTrack[] | null
  queueUpdatedAt: number
  /** True when a 403/Premium-related failure blocked playback/API access. */
  premiumBlocked: boolean
  premiumBlockedMessage: string | null
  lastError: { message: string; at: number } | null
  /** Set while the official Spotify embed player is open (free-account audio path). */
  embed: { type: 'track' | 'album' | 'playlist'; id: string } | null

  setSnapshot: (s: Snapshot | null) => void
  setIdle: (idle: boolean) => void
  setDevices: (d: SpotifyDevice[]) => void
  setActiveDevice: (id: string | null) => void
  setInApp: (state: Partial<InAppDeviceState>) => void
  setVolume: (v: number) => void
  setQueue: (q: SpotifyTrack[] | null) => void
  setPremiumBlocked: (blocked: boolean, message?: string | null) => void
  setLastError: (message: string | null) => void
  openEmbed: (embed: { type: 'track' | 'album' | 'playlist'; id: string }) => void
  closeEmbed: () => void
}

export const usePlayer = create<PlayerStore>((set) => ({
  snapshot: null,
  idle: false,
  devices: [],
  activeDeviceId: null,
  inApp: { id: null, status: 'off', widevine: null },
  volume: 70,
  queue: null,
  queueUpdatedAt: 0,
  premiumBlocked: false,
  premiumBlockedMessage: null,
  lastError: null,
  embed: null,

  setSnapshot: (snapshot) => set({ snapshot }),
  setIdle: (idle) => set({ idle }),
  setDevices: (devices) => set({ devices }),
  setActiveDevice: (activeDeviceId) => set({ activeDeviceId }),
  setInApp: (inApp) => set((s) => ({ inApp: { ...s.inApp, ...inApp } })),
  setVolume: (volume) => set({ volume }),
  setQueue: (queue) => set({ queue, queueUpdatedAt: Date.now() }),
  setPremiumBlocked: (premiumBlocked, premiumBlockedMessage = null) => set({ premiumBlocked, premiumBlockedMessage }),
  setLastError: (message) => set({ lastError: message ? { message, at: Date.now() } : null }),
  openEmbed: (embed) => set({ embed }),
  closeEmbed: () => set({ embed: null })
}))

/** Where playback should go: explicit choice > in-app device > active server device. */
export function devicePreference(store: Pick<PlayerStore, 'activeDeviceId' | 'inApp' | 'devices'>): string | undefined {
  if (store.activeDeviceId) return store.activeDeviceId
  if (store.inApp.status === 'ready' && store.inApp.id) return store.inApp.id
  return store.devices.find((d) => d.is_active)?.id ?? store.devices[0]?.id
}

/** Effective progress accounting for time since the last state update (used while playing). */
export function liveProgress(snapshot: Snapshot | null): number {
  if (!snapshot) return 0
  const base = snapshot.progressMs ?? 0
  if (!snapshot.isPlaying) return base
  const elapsed = Date.now() - snapshot.updatedAt
  const projected = base + Math.max(0, elapsed)
  if (snapshot.durationMs > 0) return Math.min(projected, snapshot.durationMs)
  return projected
}
