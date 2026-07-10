import type { Session } from '../types'
import type { User } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'
import { App as CapApp } from '@capacitor/app'
import { getSupabase } from '../services/supabase'
import { upsertMyProfile } from '../services/db'

/** Custom URL scheme that bounces OAuth back into the native shell.
 *  Must be registered in ios/App/App/Info.plist (CFBundleURLTypes) and in
 *  Supabase Auth → URL Configuration → additional redirect URLs. */
const NATIVE_AUTH_CALLBACK = 'deepsocial://auth-callback'

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

  if (Capacitor.isNativePlatform()) {
    // Google refuses OAuth inside embedded webviews (disallowed_useragent),
    // so the consent flow runs in the system browser and returns via our
    // custom URL scheme; initNativeAuth() finishes the PKCE exchange.
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: NATIVE_AUTH_CALLBACK, skipBrowserRedirect: true },
    })
    if (error) throw new Error(error.message)
    if (!data?.url) throw new Error('no authorization URL returned')
    nativeCallbackReceived = false
    const cancelled = new Promise<Session>((_, reject) => {
      nativePendingReject = reject
    })
    await Browser.open({ url: data.url })
    // Success: appUrlOpen → exchangeCodeForSession → SIGNED_IN (App adopts
    // the session and this screen unmounts). Cancel: browserFinished fires
    // without a callback and rejects, so the login screen recovers instead
    // of staying stuck in "connecting…" (the page never unloads natively).
    return cancelled
  }

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

// Coordination between the pending native sign-in promise and the two
// browser events: a completed callback must win over the dismissal event
// (Browser.close() after success also fires browserFinished).
let nativePendingReject: ((e: Error) => void) | null = null
let nativeCallbackReceived = false

/** Native shell only: completes OAuth when the system browser bounces back
 *  on deepsocial://auth-callback?code=…, rejects the pending sign-in when
 *  the browser is dismissed without completing, and routes QR connect links
 *  that open the app. Safe to call unconditionally — no-ops on the web. */
export function initNativeAuth(): void {
  if (!Capacitor.isNativePlatform()) return

  void CapApp.addListener('appUrlOpen', async ({ url }) => {
    if (url.startsWith(NATIVE_AUTH_CALLBACK)) {
      nativeCallbackReceived = true
      await Browser.close().catch(() => {})
      const code = new URL(url).searchParams.get('code')
      if (!code) return
      const { error } = await getSupabase().auth.exchangeCodeForSession(code)
      if (error) console.warn('[auth] native code exchange failed:', error.message)
      // Success fires onAuthStateChange(SIGNED_IN) — App adopts the session.
    } else {
      // Universal/QR links (https://…/#/connect/<id>) reuse the web handler.
      const m = url.match(/#\/connect\/([0-9a-fA-F-]{36})/)
      if (m) localStorage.setItem('deep-social.pending-connect', m[1])
    }
  })

  void Browser.addListener('browserFinished', () => {
    if (!nativeCallbackReceived && nativePendingReject) {
      nativePendingReject(new Error('sign-in window was closed'))
    }
    nativePendingReject = null
    nativeCallbackReceived = false
  })
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
