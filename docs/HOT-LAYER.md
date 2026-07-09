# Hot Layer — Architectural Proposal (Stage 1)

*Status: evaluated & approved for documentation, not yet scheduled. 2026-07-07.*

The Hot Layer is a simulation engine that doesn't just show where people are —
it consumes real-time geospatial and "vibe" (transient interest) events to
detect **social density** and emit **Social Events** ("a cluster of live-music
people is forming at Rives de Clausen") onto everyone's map in near-real-time.

## 0. Grounding constraints

Findings that shaped every recommendation below:

1. **Deep Social is a static web app with no server of its own.** Every
   "engine" option must answer *where does it run?* — that is the real
   architectural fork, more than any framework choice.
2. **High-frequency GPS tracking is unavailable on the web.** A browser app
   cannot track location in the background; any cadence applies only while
   the tab is open. This decides §3b before battery cost enters the debate.
3. **A Follow/Unfollow graph is cut from Stage 1.** The app deliberately
   unified its social graph into mutual `friendships` (gating DMs and
   visibility-bypass). An asymmetric follow graph would re-fragment that,
   and nothing in the density/vibe loop consumes it.
4. **Cold start is the dominant risk, not latency.** With a small beta
   userbase, real clusters will rarely form. Mitigation: the existing demo
   simulation members become **synthetic agents emitting the same event
   schema as real users**. The engine processes both identically — the Hot
   Layer is demoable on day one and gets truer as real users arrive.
5. **Privacy:** the engine may consume precise positions but only ever emits
   **aggregates with a k-anonymity floor (k ≥ 3)**. Ghost-mode users are
   excluded entirely, observer positions are cell-snapped before ingestion,
   and raw position events are TTL-pruned. Density is a privacy-friendlier
   output than individual dots.

## 1. Implementation options

### 1a. Real-time / backend layer

| | Path A — Supabase Realtime (standard) | Path B — self-hosted Elixir/Phoenix or Node ws |
|---|---|---|
| Transport | Broadcast (ephemeral fan-out), Presence, `postgres_changes` | Raw WebSockets, custom protocol |
| Ops burden | Zero — already deployed & authenticated | New service, hosting, TLS, JWT bridging |
| Ceiling | ~200 concurrent (free tier) | Effectively unbounded for a prototype |

**Choice: Path A**, with one hard rule: **position updates ride Broadcast
channels, never the database** (`postgres_changes` writes a row per message —
fine for pins, ruinous for position streams). Note: Supabase Realtime *is*
Phoenix/OTP — Path A gets Elixir's soft-realtime engine without operating it.

### 1b. Simulation engine

| | Path A — single tick worker (centralized) | Path B — zone actors (distributed) |
|---|---|---|
| Model | One process; pure `step(state, events[]) → (state', SocialEvent[])` on a fixed tick | One actor per H3 cell (GenServers / Cloudflare Durable Objects) |
| Determinism | Trivial — single writer, single clock | Hard — per-zone ordering, cross-zone coordination |
| Handoff problem | Doesn't exist | Exists and must be solved |
| Runs where | Tiny Node worker (Fly.io/Railway, ~$0–5/mo) | Durable Objects are the only low-ops variant |

**Choice: Path A, ticking every 3–5 s.** At prototype scale one process has
orders of magnitude of headroom. Insurance for later sharding: **key every
event with its H3 cell from day one**, making a future move to Path B a
routing change, not a data-model rewrite.

### 1c. State management

**Choice: the engine process is the cache.** Hot state (live positions, vibe
assignments, cluster membership) lives in worker memory. Postgres durably
holds only: the input event log (§3c), emitted `social_events` (late-joining
clients fetch current hot spots), and everything the app already owns. Redis
solves a problem this prototype doesn't have. Crash recovery = replay the
recent event log (determinism, §2a, provides this for free).

### 1d. Geospatial management

**Choice: hybrid, weighted to in-process H3.** The engine buckets positions
into H3 cells (resolution 8–9 ≈ 0.7–0.1 km hexes) via `h3-js` and runs an
in-memory DBSCAN per tick. PostGIS (already deployed & smoke-tested) remains
the durable layer and analytics tool (`ST_ClusterDBSCAN` for offline
analysis). The tested privacy RPCs stay untouched.

## 2. Feasibility — the core loop

### 2a. Deterministic simulation
Feasible with four disciplines: (1) totally ordered event log — the engine
assigns monotonic sequence numbers on ingestion; (2) fixed ticks — events
buffer between ticks; (3) no wall-clock or unseeded randomness inside the
step — time is the tick number; randomness is a PRNG seeded by
`(world_seed, tick, h3_cell)`; (4) the step is a pure function.

The organic feel lives in the **presentation layer**: staggered reveals,
easing, pulses, client-side jitter seeded per-`social_event` id. Replays stay
bit-identical while the UI feels alive. Determinism's practical payoff:
record a day of events, replay in tests, assert golden outputs — the SQL
smoke-suite pattern applied to the engine.

### 2b. The handoff problem
Dissolved by centralization — a user crossing zones is a hash-bucket change
inside one process. Rules that keep it dissolved after any future sharding:
**hysteresis** at zone boundaries (enter at edge, exit ~150 m past it) and
**micro-chat keyed by `cluster_id`, never `zone_id`** — clusters are
persistent objects that drift across cells, their chat drifts with them.

### 2c. Latency & convergence
Pipeline budget: client publish (0–2 s batching) → broadcast (~100 ms) →
**tick wait (0–5 s: the floor)** → clustering (ms) → fan-out (~100–250 ms) →
render. Worst ≈ 7 s, typical ≈ 3–4 s — well inside "feels real-time" for
social density. **Micro-chat must not ride the tick**: peer-to-channel
directly (sub-300 ms); the engine only observes. *The engine emits weather,
not conversation.*

## 3. Tradeoffs

- **Centralized vs. distributed:** below ~1k concurrent users the single
  engine wins on determinism, handoff, ops, and debuggability; sharding buys
  capacity we can't use yet. Pay the H3-keying insurance premium and defer.
- **Update frequency:** high-frequency GPS is moot on the web and burns
  quota for fidelity density can't use (it changes over minutes). **Adaptive
  heartbeat:** ~25 s while foregrounded, immediate on >100 m movement or vibe
  change. Existing 2 h freshness window and visibility gates apply unchanged.
  ~2–4 msgs/min/user → hundreds of users fit free-tier quotas.
- **Data modeling:** full event sourcing would poison a working CRUD app;
  pure relational sacrifices replay. **Thin middle:** one append-only
  `hot_events (seq, at, kind, user_id, h3_cell, payload jsonb)` table,
  TTL-pruned to 7 days, used *only* as engine input. App tables stay
  authoritative for the app.
- **New primitive — vibes:** interests are durable; vibes are *tonight*.
  A session-scoped `current_vibe` (one tag + optional emoji, TTL ~3 h, set
  from the profile menu) is the clustering signal — the difference between
  "people are here" and "people are here *for the same reason*."

## Recommended MVP stack

| Layer | Choice |
|---|---|
| Client | Existing React/Leaflet + canvas heat/cluster overlay; heartbeats out, `social_events` in |
| Transport | Supabase Broadcast (positions, micro-chat), Presence (roster), `postgres_changes` (durable objects only) |
| Engine | One Node worker (Fly.io), 3–5 s tick, pure step fn, seeded PRNG, `h3-js` + in-memory DBSCAN |
| State | Engine memory (hot) · Postgres `hot_events` log (TTL 7 d) + `social_events` output |
| Geo | H3 res 8–9 in-engine; PostGIS unchanged for durability/analytics |
| Synthetic load | Existing sim members re-emitted as agents through the same event schema |
| Privacy | k ≥ 3 rendering floor; ghost excluded; observers cell-snapped; raw events TTL |

**Cut from Stage 1:** follow graph, Redis, zone actors, sub-heartbeat GPS.

## Sequence: GPS movement → match on another user's map

```
User A (moving)          Supabase Realtime         Engine Worker              Postgres              User B
   │                          │                        │                         │                     │
   │ GPS fix (>100m moved)    │                        │                         │                     │
   ├─ broadcast: heartbeat ──▶│                        │                         │                     │
   │  {user, h3_cell, vibe}   ├─ fan-out ─────────────▶│                         │                     │
   │                          │                        │ buffer event, assign seq│                     │
   │                          │                        ├─ append hot_event ─────▶│                     │
   │                          │            ═══ TICK n (every 3-5s) ═══           │                     │
   │                          │                        │ step(state, events):    │                     │
   │                          │                        │  · bucket by H3 cell    │                     │
   │                          │                        │  · DBSCAN density scan  │                     │
   │                          │                        │  · vibe-affinity check  │                     │
   │                          │                        │  · k≥3? → SocialEvent   │                     │
   │                          │                        ├─ insert social_event ──▶│                     │
   │                          │◀─ broadcast: hot-layer ┤                         │                     │
   │                          ├─ fan-out ──────────────┼─────────────────────────┼────────────────────▶│
   │                          │                        │                         │   heat blob pulses  │
   │                          │                        │                         │   on B's map; tap → │
   │                          │◀════════ micro-chat channel (cluster_id) ════════│═══ B joins chat ═══▶│
```

## Build order (each increment shippable alone)

1. **Vibes + heartbeats** — `current_vibe` setter in the profile menu;
   Broadcast heartbeat publishing behind the existing visibility gates.
   Pure additions to the current stack.
2. **Engine worker + synthetic agents** — tick loop, event log, clustering;
   sim members feed it from day one.
3. **Hot-layer rendering** — heat/cluster overlay + `social_events` toasts,
   layer-toggle integration ("🔥 Hot" joins All/Friends/Events).
4. **Cluster micro-chat** — ephemeral Broadcast channel per cluster id.
