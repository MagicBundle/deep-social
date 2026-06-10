// Provider credentials are injected at build time. Locally: put them in
// .env.local (gitignored). In CI: set a repository variable so the Pages
// build picks it up — see docs/AUTH.md. An OAuth *client id* is public by
// design (it ships in the JS bundle either way); never put secrets here.
export const AUTH_CONFIG = {
  googleClientId: (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || undefined,
}
