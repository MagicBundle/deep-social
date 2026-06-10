# Deep Social

[![CI & Deploy](https://github.com/MagicBundle/deep-social/actions/workflows/deploy.yml/badge.svg)](https://github.com/MagicBundle/deep-social/actions/workflows/deploy.yml)

**🌍 Live demo: <https://magicbundle.github.io/deep-social/>**

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
| Map-first UI (Leaflet + dark CARTO tiles, demo city: Paris) | ✅ |
| Live tracking — simulated members roam or *head to events they plan to attend*, attendee counts update as they arrive | ✅ |
| Interest filter chips (music, running, food, tech, …) that dim non-matching pins | ✅ |
| Universal search (events / people / interests) in the menu bar, with fly-to | ✅ |
| Event cards → **Join meetup** → "My meetups" tab | ✅ |
| Per-event interest chat with simulated participants | ✅ |
| Social sign-in: **Google (real OAuth**, once a client id is configured — [docs/AUTH.md](docs/AUTH.md)**)**, Apple/Meta in labeled demo mode | ✅ |
| Session persistence (localStorage) + sign-out | ✅ |

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
2. **Realtime presence & movement** — WebSockets (e.g. Supabase Realtime, Ably, or a small Elixir/Phoenix or Node `ws` service). Client publishes opt-in location at a chosen precision; server fans out per map-viewport region (geohash sharding).
3. **Geo queries** — PostgreSQL + PostGIS (`ST_DWithin` for "near me", GiST index on event/member locations).
4. **Chat** — same realtime channel infra; one channel per event + per interest; persist to Postgres.
5. **Privacy (non-negotiable for live location)** — sharing is opt-in and granular: precise / neighborhood-fuzzed (~500 m jitter) / ghost mode; auto-expiry ("share for 2 h"); visible-to (everyone / shared-interest matches / accepted connections only); no location history retention by default.
6. **Mobile** — the UI is responsive; a Capacitor wrapper or React Native port gets native background-location and push for "someone with your interests just checked in nearby".
