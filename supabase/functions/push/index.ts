// Deep Social — push Edge Function (APNs send side).
// Invoked by the client after a DM / friend request / accept. Verifies the
// caller, checks a friendship exists between caller and target (anti-spam),
// then delivers to the target's registered devices via APNs token auth.
//
// Env (set via `supabase secrets set`): APNS_KEY (.p8 contents),
// APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID. SUPABASE_URL / _ANON_KEY /
// _SERVICE_ROLE_KEY are auto-injected by the platform.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const enc = new TextEncoder()
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, 'content-type': 'application/json' },
  })

function b64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// The APNs provider JWT lives up to 1 h; cache the key + a fresh-ish token.
let cachedKey: CryptoKey | null = null
let cachedJwt = { value: '', iat: 0 }

async function providerJwt(): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  if (cachedJwt.value && now - cachedJwt.iat < 2400) return cachedJwt.value
  if (!cachedKey) {
    const pem = Deno.env.get('APNS_KEY')!
    const der = Uint8Array.from(
      atob(pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')),
      (c) => c.charCodeAt(0),
    )
    cachedKey = await crypto.subtle.importKey(
      'pkcs8',
      der,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign'],
    )
  }
  const header = b64url(enc.encode(JSON.stringify({ alg: 'ES256', kid: Deno.env.get('APNS_KEY_ID') })))
  const payload = b64url(enc.encode(JSON.stringify({ iss: Deno.env.get('APNS_TEAM_ID'), iat: now })))
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cachedKey,
    enc.encode(`${header}.${payload}`),
  )
  cachedJwt = { value: `${header}.${payload}.${b64url(new Uint8Array(sig))}`, iat: now }
  return cachedJwt.value
}

// Dev builds (Xcode → device) get sandbox tokens; TestFlight/App Store get
// production. Try sandbox first, fall back to production on a wrong-env
// reason; delete tokens APNs reports as permanently dead.
const WRONG_ENV = new Set(['BadDeviceToken', 'BadEnvironmentKeyInToken', 'DeviceTokenNotForTopic'])

async function deliver(
  token: string,
  jwt: string,
  topic: string,
  body: string,
  admin: ReturnType<typeof createClient>,
): Promise<boolean> {
  for (const host of ['api.sandbox.push.apple.com', 'api.push.apple.com']) {
    const res = await fetch(`https://${host}/3/device/${token}`, {
      method: 'POST',
      headers: {
        authorization: `bearer ${jwt}`,
        'apns-topic': topic,
        'apns-push-type': 'alert',
        'apns-priority': '10',
      },
      body,
    })
    if (res.status === 200) return true
    const reason = (await res.json().catch(() => ({}))).reason
    if (res.status === 410 || reason === 'Unregistered') {
      await admin.from('device_push_tokens').delete().eq('token', token)
      return false
    }
    if (WRONG_ENV.has(reason)) continue // try the other environment
    return false
  }
  return false
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { to, kind, preview } = await req.json()
    if (!to || !kind) return json({ error: 'bad request' }, 400)

    const url = Deno.env.get('SUPABASE_URL')!
    const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const {
      data: { user },
    } = await caller.auth.getUser()
    if (!user) return json({ error: 'unauthorized' }, 401)
    if (user.id === to) return json({ sent: 0 })

    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // Anti-spam: a friendship row (any status) must link the two.
    const { data: fr } = await admin
      .from('friendships')
      .select('status')
      .or(
        `and(requester_id.eq.${user.id},addressee_id.eq.${to}),and(requester_id.eq.${to},addressee_id.eq.${user.id})`,
      )
      .limit(1)
    if (!fr || fr.length === 0) return json({ error: 'not permitted' }, 403)

    const { data: prof } = await admin
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .single()
    const name = prof?.display_name ?? 'Someone'

    let title = name
    let alert = String(preview ?? '').slice(0, 140)
    if (kind === 'friend_request') {
      title = 'New friend request'
      alert = `${name} wants to connect`
    } else if (kind === 'friend_accepted') {
      alert = `${name} accepted your friend request 🎉`
    } else if (!alert) {
      alert = 'sent you a message'
    }
    const data = { type: kind === 'dm' ? 'dm' : 'friend', friendId: user.id }

    const { data: tokens } = await admin
      .from('device_push_tokens')
      .select('token')
      .eq('user_id', to)
    if (!tokens || tokens.length === 0) return json({ sent: 0 })

    const jwt = await providerJwt()
    const topic = Deno.env.get('APNS_BUNDLE_ID')!
    const payload = JSON.stringify({ aps: { alert: { title, body: alert }, sound: 'default' }, ...data })

    let sent = 0
    for (const { token } of tokens) {
      if (await deliver(token as string, jwt, topic, payload, admin)) sent++
    }
    return json({ sent })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
