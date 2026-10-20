import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { HashRouter } from 'react-router-dom'
import { App } from './App'
import { queryClient } from './lib/queryClient'
import { playerEngine } from './player/engine'

import './index.css'
import { initThemeObserver } from './lib/theme'

initThemeObserver()
playerEngine.init()

// Last-resort diagnostics: never let a bootstrap crash show a silent blank
// window again — whatever throws paints itself in the window instead.
function renderFatal(label: string, err: unknown): void {
  const message = err instanceof Error ? `${err.message}\n\n${err.stack ?? ''}` : String(err)
  console.error(`[attune] ${label}:`, err)
  const box = document.createElement('pre')
  box.style.cssText =
    'position:fixed;inset:auto 16px 16px 16px;z-index:99999;max-height:45%;overflow:auto;' +
    'margin:0;padding:12px 14px;border-radius:8px;background:#1a1917;color:#faf9f7;' +
    'font:12px/1.5 Consolas,monospace;white-space:pre-wrap'
  box.textContent = `${label}\n\n${message}`
  document.body.appendChild(box)
}

window.addEventListener('error', (event) => {
  if (event.error) renderFatal('Unhandled error', event.error)
})
window.addEventListener('unhandledrejection', (event) => {
  renderFatal('Unhandled rejection', event.reason)
})

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <QueryClientProvider client={queryClient}>
    <HashRouter>
      <App />
    </HashRouter>
  </QueryClientProvider>
)
