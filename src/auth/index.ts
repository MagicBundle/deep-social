import type { Provider, Session } from '../types'
import { AUTH_CONFIG } from './config'
import { preloadGoogle, signInWithGoogle } from './google'

// Single entry point for authentication. Each provider is either 'live'
// (real OAuth, credentials configured) or 'demo' (simulated locally).
// Apple and Meta stay demo until a backend exists: Sign in with Apple
// needs a paid developer account + registered domain, and Facebook Login
// needs app review — both are documented in docs/AUTH.md.

export type ProviderMode = 'live' | 'demo'

const STORAGE_KEY = 'deep-social.session.v1'
const MOCK_DELAY_MS = 800

export function providerMode(provider: Provider): ProviderMode {
  if (provider === 'google' && AUTH_CONFIG.googleClientId) return 'live'
  return 'demo'
}

export async function signIn(provider: Provider): Promise<Session> {
  if (provider === 'google' && AUTH_CONFIG.googleClientId) {
    return signInWithGoogle(AUTH_CONFIG.googleClientId)
  }
  await new Promise((r) => setTimeout(r, MOCK_DELAY_MS))
  return { name: 'Jérôme', provider, avatar: '😎', real: false }
}

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

export function saveSession(session: Session): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  } catch {
    // Private-mode storage failures just mean no persistence
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

export { preloadGoogle }
