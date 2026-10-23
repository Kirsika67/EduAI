import '@fontsource/dm-sans/latin-400.css'
import '@fontsource/dm-sans/latin-ext-400.css'
import '@fontsource/dm-sans/latin-500.css'
import '@fontsource/dm-sans/latin-ext-500.css'
import '@fontsource/dm-sans/latin-600.css'
import '@fontsource/dm-sans/latin-ext-600.css'
import '@fontsource/dm-sans/latin-700.css'
import '@fontsource/dm-sans/latin-ext-700.css'
import '@fontsource/newsreader/latin-600.css'
import '@fontsource/newsreader/latin-ext-600.css'
import '@fontsource/newsreader/latin-700.css'
import '@fontsource/newsreader/latin-ext-700.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { ClassProvider } from './context/ClassContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ClassProvider>
          <App />
        </ClassProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)

/** PWA: teenindustöötaja ainult tootmisehituses. */
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* rakendus töötab ka ilma */ })
  })
}
