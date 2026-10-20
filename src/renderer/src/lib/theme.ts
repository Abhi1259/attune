import type { AttuneSettings } from '../../../preload/index.d'

type ThemeMode = AttuneSettings['themeMode']

let currentMode: ThemeMode = 'system'
let applied: 'light' | 'dark' = 'light'

function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function applyTheme(mode: ThemeMode): 'light' | 'dark' {
  currentMode = mode
  applied = mode === 'dark' || (mode === 'system' && systemPrefersDark()) ? 'dark' : 'light'
  document.documentElement.classList.toggle('dark', applied === 'dark')
  return applied
}

export function setThemeMode(mode: ThemeMode): void {
  applyTheme(mode)
}

export function currentThemeIsDark(): boolean {
  return applied === 'dark'
}

/** Re-applies the theme class when the OS scheme flips while on 'system'. */
export function initThemeObserver(): void {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (currentMode === 'system') applyTheme('system')
  })
}
