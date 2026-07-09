# Deep Social

[![CI & Deploy](https://github.com/MagicBundle/deep-social/actions/workflows/deploy.yml/badge.svg)](https://github.com/MagicBundle/deep-social/actions/workflows/deploy.yml)

**🌍 Live demo: <https://magicbundle.github.io/deep-social/>** · Beta — see the [privacy notice](PRIVACY.md)

**Your city's social layer, live.** A map-forward social network: the map *is* the home screen. People and events appear as live pins, filtered by shared interests, with one tap from "I see you" to chat to an actual meetup.

## Run it

```bash
npm install
npm run dev      # → http://localhost:5173
```

Sign in with any of the social buttons (mocked locally — see below) or as guest.

## What's in the prototype

| Feature | Status |
| --- | --- |
| Map-first UI (Leaflet + dark CARTO tiles, demo country: Luxembourg) | ✅ |
| Live tracking — simulated members roam or *head to events they plan to attend*, attendee counts update as they arrive | ✅ |
| Interest filter chips (music, running, food, tech, …) that dim non-matching pins | ✅ |
| Universal search (events / people / interests) in the menu bar, with fly-to | ✅ |
| Event cards → **Join meetup** → "My meetups" tab | ✅ |
| Per-event interest chat with simulated participants | ✅ |
| Social sign-in: **Google (real OAuth** via Supabase — [docs/AUTH.md](docs/AUTH.md)**)** + a no-account demo mode; Apple/Meta planned | ✅ |
| Session persistence (localStorage) + sign-out | ✅ |
| **Data backbone**: PostGIS schema + RLS, nearby queries, realtime posts, presence — live once a Supabase project is connected ([docs/BACKEND.md](docs/BACKEND.md)) | ✅ code + migration |
| **Pin your own event**: 📍 button → click the map → composer (activity, title, time) → shared live via Supabase for real sessions, local in demo | ✅ |
| **Address search & reverse geocoding** (Photon/OSM, no key): map clicks resolve to real addresses, and the composer's place search relocates the pin | ✅ |
| **Real attendance**: join/leave persists to the DB with live counts on every map | ✅ |
| **Vibe Checks 📸**: attendees attach photos to pins (EXIF-stripped, compressed client-side); camera badge on the map, carousel + report button in the card | ✅ |
| **Mobile bottom-sheet UI**: draggable peek/half/full events sheet (~90% map visible collapsed), horizontal glass filter bar, iOS safe-area aware | ✅ |
| **Visitor geolocation**: map centers on you (with permission), Luxembourg fallback | ✅ |
| **Member search + friends**: top-bar search finds real registered members; requests / auto-accept / decline / remove in a live-updating Friends tab | ✅ |
| **Direct messages**: tap an accepted friend to open a 1:1 chat (friendship-gated in RLS), realtime delivery, unread badges | ✅ |
| **Visibility modes** (Ghost / Observer / Beacon): control what strangers see; friends always see you. Enforced in `nearby_profiles` | ✅ |
| **QR in-person handshake**: "Share my presence" → QR of an HTTPS deep link; scanning with a phone camera sends a connection request and shows the "Deep Card" profile | ✅ |
| **Real presence on the map**: nearby members render live — beacons with avatars, observers as anonymous dashed dots, friends green-ringed; tap → person card with connect / accept / message | ✅ |
| **Map layers**: ✨ All / 👥 Friends only / 📍 Events only toggle on the map | ✅ |
| **Friend profiles**: tap a friend's avatar/name → minimal profile (friends-since, interests, distance, show-on-map, message, remove) | ✅ |

## Architecture

```
src/
  data/mock.ts        seed data: interests, members, events, chat lines
  sim/engine.ts       useSimulation() — stand-in for the realtime backend;
                      moves members each tick, handles event arrivals
  components/
    MapView.tsx       Leaflet map, custom div-icon markers, fly-to, filter dimming
    TopBar.tsx        menu bar: brand, universal search, live counter, account menu
    SidePanel.tsx     interest chips + Happening / People / My meetups tabs
    EventCard.tsx     event detail + Join + Chat entry point
    ChatDrawer.tsx    per-event chat channel
    LoginScreen.tsx   social sign-in (mocked OAuth)
  App.tsx             state orchestration (session, filters, selection, chat, toasts)
```

The simulation tick (1.5 s) is deliberately shaped like a realtime feed: swapping `useSimulation` for a WebSocket subscription is the intended seam.

## Path to production

1. **Auth** — Google sign-in is implemented client-side (Google Identity Services token flow) and goes live with a client id: see [docs/AUTH.md](docs/AUTH.md). Apple (paid developer account + registered domain) and Meta (app review) are cleanest via Supabase Auth or [Auth.js](https://authjs.dev) once a backend exists; `src/auth/index.ts` is the only file that routes providers, and the `Session` type in `src/types.ts` stays the UI contract.
2. **Realtime presence & movement** — implemented: Supabase Realtime (`postgres_changes` for posts, Presence for live positions) in [src/services/db.ts](src/services/db.ts); goes live with the backend ([docs/BACKEND.md](docs/BACKEND.md)).
3. **Geo queries** — implemented: PostGIS `ST_DWithin` RPCs with privacy tiers and GiST indexes in [supabase/migrations/0001_init.sql](supabase/migrations/0001_init.sql); next step is feeding `useSimulation`'s World from them.
4. **Chat** — same realtime channel infra; one channel per event + per interest; persist to Postgres.
5. **Privacy (non-negotiable for live location)** — sharing is opt-in and granular: precise / neighborhood-fuzzed (~500 m jitter) / ghost mode; auto-expiry ("share for 2 h"); visible-to (everyone / shared-interest matches / accepted connections only); no location history retention by default.
6. **Mobile** — the UI is responsive; a Capacitor wrapper or React Native port gets native background-location and push for "someone with your interests just checked in nearby".
7. **Facebook event import** — sync a user's existing Facebook events onto the map as pins (Graph API `user_events` scope; requires Meta app review). Deliberately parked until Meta login lands via Supabase Auth.
