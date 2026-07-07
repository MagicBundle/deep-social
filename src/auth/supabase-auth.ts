import type { Session } from '../types'
import type { User } from '@supabase/supabase-js'
import { getSupabase } from '../services/supabase'
import { upsertMyProfile } from '../services/db'

// Auth-to-DB bridge, client half. When Supabase is configured, Google
// sign-in routes through Supabase Auth (PKCE redirect) instead of the raw
// GIS popup — that is what gives the client a database JWT, which is what
// makes auth.uid() (and therefore every RLS policy) work.

function displayName(user: User): string {
  const meta = user.user_metadata ?? {}
  return (
    (meta.full_name as string | undefined) ||
    (meta.name as string | undefined) ||
    user.email?.split('@')[0] ||
    'Member'
  )
}

function mapUser(user: User): Session {
  return {
    name: displayName(user),
    provider: 'google',
    avatar: '🙂',
    id: user.id,
    email: user.email ?? undefined,
    picture: (user.user_metadata?.avatar_url as string | undefined) ?? undefined,
    real: true,
  }
}

// Refresh mutable identity fields on every sign-in. Must never block or
// break auth — the DB trigger already guarantees the row exists.
function syncProfile(user: User): void {
  upsertMyProfile({
    id: user.id,
    email: user.email ?? undefined,
    displayName: displayName(user),
    avatarUrl: (user.user_metadata?.avatar_url as string | undefined) ?? undefined,
  }).catch((e) => console.warn('[auth] profile sync failed:', e))
}

export async function signInWithGoogleViaBackend(): Promise<Session> {
  const supabase = getSupabase()
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      // Back to exactly where the SPA lives ('/' in dev, '/deep-social/' on
      // Pages). Must be whitelisted in Supabase Auth → URL Configuration.
      redirectTo: window.location.origin + import.meta.env.BASE_URL,
    },
  })
  if (error) throw new Error(error.message)
  // The browser is now navigating to the consent screen; this promise
  // intentionally never settles. The session is picked up after the
  // redirect by restoreBackendSession/onBackendAuthChange.
  return new Promise<Session>(() => {})
}

export async function restoreBackendSession(): Promise<Session | null> {
  const supabase = getSupabase()
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session) return null
  // Drop leftover PKCE params from the redirect return URL.
  if (window.location.search.includes('code=')) {
    window.history.replaceState(null, '', window.location.pathname)
  }
  syncProfile(data.session.user)
  return mapUser(data.session.user)
}

export function onBackendAuthChange(onSession: (s: Session | null) => void): () => void {
  const { data } = getSupabase().auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) {
      syncProfile(session.user)
      onSession(mapUser(session.user))
    } else if (event === 'SIGNED_OUT') {
      onSession(null)
    }
  })
  return () => data.subscription.unsubscribe()
}

export async function signOutBackend(): Promise<void> {
  try {
    await getSupabase().auth.signOut()
  } catch (e) {
    console.warn('[auth] backend sign-out failed:', e)
  }
}
