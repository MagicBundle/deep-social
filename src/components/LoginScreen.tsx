import { useState } from 'react'
import type { Provider } from '../types'

interface Props {
  onLogin: (provider: Provider) => void
}

const PROVIDER_LABEL: Record<Provider, string> = {
  apple: 'Apple',
  google: 'Google',
  facebook: 'Meta',
  guest: 'guest mode',
}

const AppleLogo = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M16.36 12.7c0-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.78-3.32-1.8-1.4-.15-2.75.83-3.46.83-.72 0-1.82-.81-3-.79-1.52.02-2.94.9-3.72 2.27-1.6 2.77-.41 6.85 1.13 9.1.76 1.1 1.66 2.33 2.84 2.29 1.15-.05 1.58-.74 2.97-.74 1.38 0 1.78.74 2.98.71 1.24-.02 2.02-1.11 2.77-2.22.88-1.27 1.23-2.51 1.25-2.57-.03-.01-2.39-.92-2.4-3.62zM14.1 5.96c.63-.77 1.06-1.83.94-2.9-.91.04-2.01.61-2.66 1.37-.59.68-1.1 1.77-.96 2.81 1.01.08 2.05-.51 2.68-1.28z" />
  </svg>
)

const GoogleLogo = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
    <path fill="#FFC107" d="M43.6 20.5H42V20.4H24v7.2h11.3C33.7 32.4 29.3 35.6 24 35.6c-6.4 0-11.6-5.2-11.6-11.6S17.6 12.4 24 12.4c3 0 5.7 1.1 7.7 3l5.1-5.1C33.5 7.1 29 5.2 24 5.2 13.6 5.2 5.2 13.6 5.2 24S13.6 42.8 24 42.8c10.4 0 18.4-7.6 18.4-18.8 0-1.2-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="M7.3 14.7l5.9 4.3c1.6-3.9 5.5-6.6 10.8-6.6 3 0 5.7 1.1 7.7 3l5.1-5.1C33.5 7.1 29 5.2 24 5.2c-7.2 0-13.4 4.1-16.7 9.5z" />
    <path fill="#4CAF50" d="M24 42.8c4.9 0 9.3-1.9 12.6-4.9l-5.8-4.9c-1.9 1.4-4.3 2.2-6.8 2.2-5.3 0-9.7-3.4-11.3-8.1l-5.9 4.6c3.2 6.5 9.9 11.1 17.2 11.1z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20.4H24v7.2h11.3c-.8 2.2-2.2 4.1-4.1 5.4l5.8 4.9c-.4.4 6.6-4.8 6.6-14 0-1.2-.1-2.4-.4-3.5z" />
  </svg>
)

const MetaLogo = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.7 4.53-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.09 24 18.1 24 12.07z" />
  </svg>
)

export default function LoginScreen({ onLogin }: Props) {
  const [connecting, setConnecting] = useState<Provider | null>(null)

  const handle = (provider: Provider) => {
    if (connecting) return
    setConnecting(provider)
    // Mock OAuth handshake. In production this redirects to the provider's
    // authorize endpoint (see README for the Auth.js / Supabase wiring).
    setTimeout(() => onLogin(provider), 800)
  }

  return (
    <div className="login-screen">
      <div className="login-blob blob-a" />
      <div className="login-blob blob-b" />
      <div className="login-blob blob-c" />

      <div className="login-card">
        <div className="login-brand">
          <div className="logo-mark">◍</div>
          <h1>
            Deep<span>Social</span>
          </h1>
        </div>
        <p className="login-tagline">Your city's social layer, live.</p>

        <ul className="login-features">
          <li>🗺️ A live map of people &amp; events around you</li>
          <li>⚡ Filter the city by what you actually care about</li>
          <li>💬 Jump into the chat, then meet in real life</li>
        </ul>

        <div className="login-buttons">
          <button className="sso-btn apple" onClick={() => handle('apple')}>
            <AppleLogo /> Continue with Apple
          </button>
          <button className="sso-btn google" onClick={() => handle('google')}>
            <GoogleLogo /> Continue with Google
          </button>
          <button className="sso-btn facebook" onClick={() => handle('facebook')}>
            <MetaLogo /> Continue with Meta
          </button>
          <button className="sso-btn guest" onClick={() => handle('guest')}>
            Explore as guest →
          </button>
        </div>

        <p className="login-status">
          {connecting
            ? `Connecting with ${PROVIDER_LABEL[connecting]}…`
            : 'Prototype: sign-in is simulated locally — no data leaves your machine.'}
        </p>
      </div>
    </div>
  )
}
