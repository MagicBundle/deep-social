#!/usr/bin/env node
// Generates the Apple "client secret" that Supabase's Apple provider needs in
// its "Secret Key (for OAuth)" field. Apple requires this to be a short-lived
// ES256 JWT signed with your Sign in with Apple .p8 key — NOT the raw .p8
// contents. It expires in <= 6 months; re-run this to rotate it.
//
// Usage (values from Apple Developer portal):
//   APPLE_TEAM_ID=XXXXXXXXXX \
//   APPLE_KEY_ID=YYYYYYYYYY \
//   APPLE_SERVICES_ID=com.deepsocial.signin \
//   APPLE_P8=./AuthKey_YYYYYYYYYY.p8 \
//   node scripts/generate-apple-secret.mjs
//
// The .p8 stays local (it's gitignored); nothing is transmitted anywhere.

import { readFileSync } from 'node:fs'
import { sign } from 'node:crypto'

const { APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_SERVICES_ID, APPLE_P8 } = process.env
for (const [k, v] of Object.entries({ APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_SERVICES_ID, APPLE_P8 })) {
  if (!v) {
    console.error(`Missing env var: ${k}`)
    process.exit(1)
  }
}

const b64url = (buf) => Buffer.from(buf).toString('base64url')
const now = Math.floor(Date.now() / 1000)

const header = { alg: 'ES256', kid: APPLE_KEY_ID, typ: 'JWT' }
const payload = {
  iss: APPLE_TEAM_ID,
  iat: now,
  exp: now + 86400 * 180, // ~6 months (Apple's max is 15777000 s)
  aud: 'https://appleid.apple.com',
  sub: APPLE_SERVICES_ID, // the Services ID = the Client ID in Supabase
}

const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`
const privateKey = readFileSync(APPLE_P8, 'utf8')
// dsaEncoding 'ieee-p1363' = raw r||s, the format JOSE/ES256 requires.
const signature = sign('sha256', Buffer.from(signingInput), {
  key: privateKey,
  dsaEncoding: 'ieee-p1363',
})

process.stdout.write(`${signingInput}.${b64url(signature)}\n`)
