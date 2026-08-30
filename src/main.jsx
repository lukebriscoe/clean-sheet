import React from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.jsx'
import { SessionProvider } from './state/session-context.jsx'
import './styles/theme.css'
import './styles/print.css'

// HashRouter, not BrowserRouter. GitHub Pages serves static files with no server
// rewrite, so a deep link like /session/abc123 would 404 on refresh. The usual fix
// is a 404.html redirect shim, which flashes and breaks in enough edge cases that
// it isn't worth it for a tool coaches open on a phone in a car park.
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <SessionProvider>
        <App />
      </SessionProvider>
    </HashRouter>
  </React.StrictMode>,
)
