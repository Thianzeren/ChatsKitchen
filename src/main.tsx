import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './theme.css'
import App from './App.tsx'
import ControllerApp from './controller/ControllerApp.tsx'

const isController = window.location.pathname === '/play'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isController ? <ControllerApp /> : <App />}
  </StrictMode>,
)
