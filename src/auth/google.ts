import type { Session } from '../types'

// Real Google sign-in via Google Identity Services' OAuth2 token client —
// the flow Google designed for SPAs with custom buttons: popup consent,
// access token delivered to a callback, no client secret involved.

interface TokenResponse {
  access_token?: string
  error?: string
  error_description?: string
}

interface TokenClient {
  requestAccessToken(): void
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string
            scope: string
            callback: (resp: TokenResponse) => void
            error_callback?: (err: { type?: string; message?: string }) => void
          }): TokenClient
        }
      }
    }
  }
}

const GIS_SRC = 'https://accounts.google.com/gsi/client'

let gisPromise: Promise<void> | null = null

// Call early (e.g. on login-screen mount) so the script is already loaded
// when the user clicks — requestAccessToken must run close to the click
// gesture or browsers may block the consent popup.
export function preloadGoogle(): Promise<void> {
  if (!gisPromise) {
    gisPromise = new Promise((resolve, reject) => {
      if (window.google?.accounts?.oauth2) return resolve()
      const script = document.createElement('script')
      script.src = GIS_SRC
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => {
        gisPromise = null
        reject(new Error('could not load the Google sign-in library'))
      }
      document.head.appendChild(script)
    })
  }
  return gisPromise
}

export async function signInWithGoogle(clientId: string): Promise<Session> {
  await preloadGoogle()
  if (!window.google?.accounts?.oauth2) {
    throw new Error('Google sign-in library unavailable')
  }
  const oauth2 = window.google.accounts.oauth2

  return new Promise<Session>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: 'openid email profile',
      callback: async (resp) => {
        if (resp.error || !resp.access_token) {
          return reject(new Error(resp.error_description || resp.error || 'no token returned'))
        }
        try {
          const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${resp.access_token}` },
          })
          if (!r.ok) throw new Error(`profile fetch failed (${r.status})`)
          const u = (await r.json()) as {
            name?: string
            given_name?: string
            email?: string
            picture?: string
          }
          resolve({
            name: u.given_name || u.name || 'Google user',
            provider: 'google',
            avatar: '🙂',
            email: u.email,
            picture: u.picture,
            real: true,
          })
        } catch (e) {
          reject(e as Error)
        }
      },
      error_callback: (err) => {
        reject(new Error(err.type === 'popup_closed' ? 'popup closed' : err.message || err.type || 'popup failed'))
      },
    })
    client.requestAccessToken()
  })
}
