import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext' // <--- Import this
import { UserSettingsProvider } from './contexts/UserSettingsContext'

createRoot(document.getElementById('root')).render(
  <AuthProvider>
    <UserSettingsProvider>
      <App />
    </UserSettingsProvider>
  </AuthProvider>,

)

// PWA: register service worker in production builds.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  });
}
