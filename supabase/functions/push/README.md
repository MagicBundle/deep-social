# `push` Edge Function — deploy & secrets

Sends APNs pushes to a target user's registered devices. Invoked by the
client after a DM / friend request / accept (`notify()` in
`src/services/push.ts`). Self-authorizing (verifies the caller and that a
friendship links the two), so it's deployed **without** the JWT gateway and
does its own auth + CORS.

## One-time deploy

The Supabase CLI is installed. From the repo root:

```bash
supabase login                                   # opens a browser to authorize
supabase link --project-ref liaiodfhlnwnzplrtdfk

# Secrets (APNS_KEY reads the local .p8; the others you already have).
# SUPABASE_URL / _ANON_KEY / _SERVICE_ROLE_KEY are injected automatically.
supabase secrets set \
  APNS_KEY="$(cat AuthKey_28B2LS4A65.p8)" \
  APNS_KEY_ID=28B2LS4A65 \
  APNS_TEAM_ID=23W659LKRJ \
  APNS_BUNDLE_ID=io.github.magicbundle.deepsocial

# --no-verify-jwt: the function checks auth itself (getUser + friendship)
# and needs to answer CORS preflight for the web client.
supabase functions deploy push --no-verify-jwt
```

## Rotating

The APNs auth key doesn't expire (unlike the Sign in with Apple secret), so
no scheduled rotation is needed. If you ever regenerate it, re-run the
`supabase secrets set APNS_KEY=…` line.

## How it picks the APNs environment

Xcode dev builds register **sandbox** tokens; TestFlight/App Store builds
register **production**. The function tries `api.sandbox.push.apple.com`
first and falls back to `api.push.apple.com` on a wrong-environment reason,
so it works for both without configuration. Tokens APNs reports as
permanently gone (`410 Unregistered`) are deleted.
