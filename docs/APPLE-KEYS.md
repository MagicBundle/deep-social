# Apple private keys (.p8) — which is which

Two Apple-issued `.p8` private keys live in the project root. Both are
gitignored (`*.p8`) and must never be committed. They look identical and
are **not interchangeable** — using the wrong one fails silently (pushes
just never arrive / sign-in just never completes).

| File | Key ID | Purpose | Where it is used |
|---|---|---|---|
| `AuthKey_28B2LS4A65.p8` | `28B2LS4A65` | **APNs** (push notifications) | Supabase Edge Function secrets: `APNS_KEY`, `APNS_KEY_ID` (set 2026-09-04) |
| `AuthKey_XS5RF4GL8H.p8` | `XS5RF4GL8H` | **Sign in with Apple** | Supabase Auth → Providers → Apple (secret regenerated from this key; expires every 6 months, see `docs/AUTH.md`) |

Shared identifiers: Team ID `23W659LKRJ`, bundle ID
`io.github.magicbundle.deepsocial`.

If in doubt, Apple Developer → Certificates, Identifiers & Profiles → Keys
lists each Key ID with the service it was enabled for.

Rule of thumb: **push = 28B2**, **sign-in = XS5R**.
