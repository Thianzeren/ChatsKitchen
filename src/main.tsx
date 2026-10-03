import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import './theme.css'

// Host game and phone controller are separate bundles: phones on /play must not
// download the host's game engine, audio, Twitch client, etc.
const App = lazy(() => import('./App.tsx'))
const ControllerApp = lazy(() => import('./controller/ControllerApp.tsx'))

const isController = window.location.pathname === '/play'
if (isController) document.body.classList.add('is-controller')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={null}>
      {isController ? <ControllerApp /> : <App />}
    </Suspense>
  </StrictMode>,
)
