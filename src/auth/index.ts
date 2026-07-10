import type { Provider, Session } from '../types'
import { AUTH_CONFIG } from './config'
import { preloadGoogle, signInWithGoogle } from './google'
import { signInWithProviderViaBackend, signOutBackend } from './supabase-auth'
import { isBackendConfigured } from '../services/supabase'

// Single entry point for authentication. Each provider is either 'live'
// (real OAuth, credentials configured) or 'demo' (simulated locally).
// Google resolution order: Supabase Auth (full DB session, RLS works) →
// client-side GIS popup (identity only, no DB) → demo. Apple and Meta stay
// demo until they're registered behind Supabase Auth — see docs/AUTH.md
// and docs/BACKEND.md.

export type ProviderMode = 'live' | 'demo'

const STORAGE_KEY = 'deep-social.session.v1'
const MOCK_DELAY_MS = 800

export function providerMode(provider: Provider): ProviderMode {
  if (provider === 'google' && (isBackendConfigured() || AUTH_CONFIG.googleClientId)) {
    return 'live'
  }
  // Apple routes through Supabase Auth (App Store guideline 4.8); requires
  // the Apple provider to be configured in the Supabase dashboard.
  if (provider === 'apple' && isBackendConfigured()) {
    return 'live'
  }
  return 'demo'
}

export async function signIn(provider: Provider): Promise<Session> {
  if (provider === 'google') {
    if (isBackendConfigured()) return signInWithProviderViaBackend('google')
    if (AUTH_CONFIG.googleClientId) return signInWithGoogle(AUTH_CONFIG.googleClientId)
  }
  if (provider === 'apple' && isBackendConfigured()) {
    return signInWithProviderViaBackend('apple')
  }
  await new Promise((r) => setTimeout(r, MOCK_DELAY_MS))
  return { name: 'Jérôme', provider, avatar: '😎', real: false }
}

/** Clears the local session and, when the backend is live, the Supabase one. */
export async function signOutEverywhere(): Promise<void> {
  clearSession()
  if (isBackendConfigured()) await signOutBackend()
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
export { restoreBackendSession, onBackendAuthChange, initNativeAuth } from './supabase-auth'
export { isBackendConfigured } from '../services/supabase'
