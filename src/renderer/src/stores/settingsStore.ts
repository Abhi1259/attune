import { create } from 'zustand'
import type { AppInfo, AttuneSettings } from '../../../preload/index.d'
import { setThemeMode } from '../lib/theme'

interface SettingsStoreData {
  settings: AttuneSettings | null
  appInfo: AppInfo | null
  load(): Promise<void>
  update(patch: Partial<AttuneSettings>): Promise<void>
}

export const useSettingsStore = create<SettingsStoreData>((set, get) => ({
  settings: null,
  appInfo: null,

  async load() {
    const [settings, appInfo] = await Promise.all([
      window.attune.getSettings().catch(() => undefined),
      window.attune.appInfo().catch(() => undefined)
    ])
    if (settings) {
      set({ settings, appInfo: appInfo ?? null })
      setThemeMode(settings.themeMode)
    }
  },

  async update(patch) {
    const next = await window.attune.setSettings(patch as Partial<AttuneSettings>)
    set({ settings: next })
    if (patch.themeMode) setThemeMode(patch.themeMode)
    void get()
  }
}))
