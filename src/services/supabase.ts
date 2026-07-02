import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { AUTH_CONFIG } from '../auth/config'

// Lazy singleton so the app never pays for (or crashes on) a client when the
// backend isn't configured — every service entry point checks first.

export class BackendNotConfiguredError extends Error {
  constructor() {
    super(
      'Backend not configured: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see docs/BACKEND.md)',
    )
    this.name = 'BackendNotConfiguredError'
  }
}

let client: SupabaseClient | null = null

export function isBackendConfigured(): boolean {
  return Boolean(AUTH_CONFIG.supabaseUrl && AUTH_CONFIG.supabaseAnonKey)
}

export function getSupabase(): SupabaseClient {
  if (!isBackendConfigured()) throw new BackendNotConfiguredError()
  if (!client) {
    client = createClient(AUTH_CONFIG.supabaseUrl!, AUTH_CONFIG.supabaseAnonKey!, {
      auth: {
        // PKCE keeps the OAuth exchange verifier-bound — the right choice for
        // a public SPA client (no secret anywhere).
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  }
  return client
}
