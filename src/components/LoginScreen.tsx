import { useEffect, useState } from 'react'
import type { Provider, Session } from '../types'
import { preloadGoogle, providerMode, signIn } from '../auth'

interface Props {
  onLogin: (session: Session) => void
}

const PROVIDER_LABEL: Record<Provider, string> = {
  apple: 'Apple',
  google: 'Google',
  facebook: 'Meta',
  guest: 'guest mode',
}

const GoogleLogo = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
    <path fill="#FFC107" d="M43.6 20.5H42V20.4H24v7.2h11.3C33.7 32.4 29.3 35.6 24 35.6c-6.4 0-11.6-5.2-11.6-11.6S17.6 12.4 24 12.4c3 0 5.7 1.1 7.7 3l5.1-5.1C33.5 7.1 29 5.2 24 5.2 13.6 5.2 5.2 13.6 5.2 24S13.6 42.8 24 42.8c10.4 0 18.4-7.6 18.4-18.8 0-1.2-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="M7.3 14.7l5.9 4.3c1.6-3.9 5.5-6.6 10.8-6.6 3 0 5.7 1.1 7.7 3l5.1-5.1C33.5 7.1 29 5.2 24 5.2c-7.2 0-13.4 4.1-16.7 9.5z" />
    <path fill="#4CAF50" d="M24 42.8c4.9 0 9.3-1.9 12.6-4.9l-5.8-4.9c-1.9 1.4-4.3 2.2-6.8 2.2-5.3 0-9.7-3.4-11.3-8.1l-5.9 4.6c3.2 6.5 9.9 11.1 17.2 11.1z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20.4H24v7.2h11.3c-.8 2.2-2.2 4.1-4.1 5.4l5.8 4.9c-.4.4 6.6-4.8 6.6-14 0-1.2-.1-2.4-.4-3.5z" />
  </svg>
)

function ModeTag({ provider }: { provider: Provider }) {
  const mode = providerMode(provider)
  return <span className={`mode-tag ${mode}`}>{mode}</span>
}

export default function LoginScreen({ onLogin }: Props) {
  const [connecting, setConnecting] = useState<Provider | null>(null)
  const [error, setError] = useState<string | null>(null)
  const googleLive = providerMode('google') === 'live'

  // Load the GIS script before the click so the consent popup stays within
  // the browser's user-gesture window.
  useEffect(() => {
    if (googleLive) preloadGoogle().catch(() => {})
  }, [googleLive])

  const handle = async (provider: Provider) => {
    if (connecting) return
    setError(null)
    setConnecting(provider)
    try {
      const session = await signIn(provider)
      onLogin(session)
    } catch (e) {
      setError(`${PROVIDER_LABEL[provider]} sign-in didn't complete: ${(e as Error).message}`)
      setConnecting(null)
    }
  }

  const statusText = error
    ? error
    : connecting
      ? `Connecting with ${PROVIDER_LABEL[connecting]}…`
      : googleLive
        ? 'Google sign-in is live. More providers coming later.'
        : 'Demo mode: sign-in is simulated locally. Wire up real Google OAuth in docs/AUTH.md.'

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
          <span className="beta-tag">BETA</span>
        </div>
        <p className="login-tagline">Your city's social layer, live.</p>

        <ul className="login-features">
          <li>🗺️ A live map of people &amp; events around you</li>
          <li>⚡ Filter the city by what you actually care about</li>
          <li>💬 Jump into the chat, then meet in real life</li>
        </ul>

        <div className="login-buttons">
          <button className="sso-btn google" onClick={() => handle('google')}>
            <GoogleLogo /> Continue with Google <ModeTag provider="google" />
          </button>
          <button className="sso-btn guest" onClick={() => handle('guest')}>
            Just looking? Explore the demo without an account →
          </button>
        </div>

        <p className={`login-status${error ? ' error' : ''}`}>{statusText}</p>
        <p className="login-legal">
          Beta software — things may break and data may be reset.{' '}
          <a
            href="https://github.com/MagicBundle/deep-social/blob/main/PRIVACY.md"
            target="_blank"
            rel="noreferrer"
          >
            Privacy notice
          </a>
        </p>
      </div>
    </div>
  )
}
