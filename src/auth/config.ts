// Central reader for build-time credentials. Locally: .env.local
// (gitignored). In CI: GitHub repository variables injected by the deploy
// workflow — see docs/AUTH.md and docs/BACKEND.md.
//
// Everything here is public-by-design (OAuth client ids, Supabase URL and
// anon key all ship in the JS bundle; the anon key is safe to expose because
// Row Level Security is enforced server-side). Never put secrets here.
export const AUTH_CONFIG = {
  /** Google OAuth client id — enables the client-side GIS fallback flow */
  googleClientId: (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || undefined,
  /** Supabase project URL, e.g. https://abcd1234.supabase.co */
  supabaseUrl: (import.meta.env.VITE_SUPABASE_URL as string | undefined) || undefined,
  /** Supabase publishable anon key (RLS makes this safe to ship) */
  supabaseAnonKey: (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || undefined,
}
