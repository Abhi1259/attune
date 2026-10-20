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

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <QueryClientProvider client={queryClient}>
    <HashRouter>
      <App />
    </HashRouter>
  </QueryClientProvider>
)
