# Authentication setup

The app's auth layer (`src/auth/`) routes each provider to either **live**
(real OAuth) or **demo** (simulated locally). Buttons on the login screen show
which mode they're in. Sessions persist in `localStorage` either way.

| Provider | Status | What it takes to go live |
| --- | --- | --- |
| Google | **Live once you add a client id** (5 minutes, free) | Steps below |
| Apple | Demo | Apple Developer Program ($99/yr), Services ID, domain verification — best added together with a backend |
| Meta | Demo | Facebook developer app + app review — best added together with a backend |

## Go live with Google

Google Identity Services supports a pure client-side flow (token client +
consent popup), so it works on GitHub Pages with no server and no secret.

1. Open [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
   and create a project (any name).
2. Configure the **OAuth consent screen**: User type *External*, app name
   "Deep Social", add your own Google account as a **test user** (while the
   app is in *Testing* status, only test users can sign in — fine for a demo).
3. **Create credentials → OAuth client ID → Web application**, and add both
   **Authorized JavaScript origins**:
   - `http://localhost:5173`
   - `https://magicbundle.github.io`

   No redirect URI is needed — the token-client popup flow only checks origins.
4. Copy the client id (ends in `.apps.googleusercontent.com`), then:

   ```bash
   # local dev — create .env.local (gitignored):
   echo 'VITE_GOOGLE_CLIENT_ID=<your-client-id>' > .env.local

   # production — set a repo variable; the deploy workflow injects it:
   gh variable set VITE_GOOGLE_CLIENT_ID --body '<your-client-id>'
   git commit --allow-empty -m 'Redeploy with Google OAuth' && git push
   ```

That's it: the Google button switches from `demo` to `live`, opens the real
consent popup, and the session carries your actual name, email, and photo.

## Security notes

- An OAuth **client id is public by design** — it ships in the JS bundle.
  There is no client secret anywhere in this flow.
- The access token never leaves the browser; it's used once to fetch
  `openid email profile` userinfo, and is not stored.
- What's persisted is only the resulting profile (name/email/picture) in
  `localStorage`, cleared on sign-out.

## Why Apple & Meta want a backend

Both providers effectively require server-side pieces for production web
login (Apple: registered return URLs + token validation; Meta: app review,
and their JS SDK's limited-login states). When the realtime backend lands
(see README roadmap), the clean path is delegating all three providers to
Supabase Auth or Auth.js, and keeping `src/auth/index.ts` as the only file
that knows the difference. The UI contract stays `Session` in `src/types.ts`.
