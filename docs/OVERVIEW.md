# Deep Social — Product & Architecture Overview

*A standalone briefing for someone with no access to the running app or its
source. It explains what Deep Social is, how it behaves, how it is built, and
where it stands. Last updated: July 2026 (beta).*

---

## 1. In one paragraph

Deep Social is a **map-forward social network**: the map *is* the home
screen. Instead of a feed, you open the app to a live map of your city where
people and events appear as glowing pins, filtered by shared interests. The
product compresses the distance between "I notice you exist" and "we actually
met in real life" into a few taps — see who's out and what's happening, find
the people who share your interests nearby, connect, chat, and meet. It is
built privacy-first: by default you appear only as an anonymous, location-
blurred dot, becoming identifiable is always a deliberate opt-in, and full
invisibility is one tap away. The current build is a
functional beta, developed by a solo indie developer, targeting launch in the
EU (Luxembourg) via the Apple App Store and the web.

---

## 2. The problem and the idea

Mainstream social apps optimise for *scrolling*, not *meeting*. They are
feed-shaped: you consume content from people you already know, mostly
elsewhere. Location-based apps that do exist tend to be either dating apps
(one narrow intent) or check-in/review apps (places, not people). There is a
gap for **ambient, interest-based, real-world social discovery**: "which people I'd
actually get along with are near me right now, and what is happening that I'd
want to join?"

Deep Social's bet is that a **live map** is the right primitive for this. A
map answers *where* and *now* natively, it makes serendipity visible, and it
naturally frames the goal as an in-person meetup rather than an endless
thread. The design language throughout is "the city's social layer, live."

The core interaction ladder the product is built around:

> **See** (there are people/events near me) → **Filter** (by what I care
> about) → **Discover** (specific people who share my interests) →
> **Connect** (send a request) → **Chat** (once accepted) → **Meet**
> (directions, safety cover) → **Remember** (a personal map of who you've met).

Every feature slots somewhere on that ladder.

---

## 3. Core concepts

Four ideas are load-bearing. Understanding them explains most of the product.

### 3.1 The map is the home screen
There is no feed. The dark, minimal map of the user's city fills the screen;
events and people are pins on it. All navigation radiates from the map. On
mobile, panels are bottom sheets over the map; on desktop, a side panel sits
beside it.

### 3.2 The visibility ladder (privacy by default)
How much a stranger can see of you is a graduated, user-controlled setting —
this is the app's spine:

- **Ghost** — you are invisible to strangers. You can use the whole app while
  being unseen.
- **Observer** *(default)* — you appear to nearby strangers as an *anonymous
  dot*: your interests show, but your name and photo are withheld and your
  location is blurred (snapped to a ~500 m grid). Your precise position is
  stored only so accepted friends can find you, never shown to strangers.
- **Beacon** — your full profile and precise location are visible to people
  nearby.

Crucially, **accepted friends always see your full profile and precise
location regardless of this setting** — friendship bypasses the ladder. This
mirrors real life: strangers get a blurry, anonymous impression; people you've
chosen get the real you. The ladder is enforced on the server (see §7), not
just hidden in the interface.

### 3.3 The interest graph
Ten interest categories (Live Music, Running, Foodies, Tech, Art & Design,
Football, Nightlife, Photography, Gaming, Yoga) act as the connective tissue.
They do three jobs at once:
- **Filter** the map (dim pins that don't match).
- **Power discovery** — find people within 50 km who share them.
- **Explain a match** — every profile leads with "✨ You both: 🎸 🧘".

A user's chosen interests are simultaneously *what they search by* and *what
makes them findable* — matching is two-sided, so setting interests is what
puts you on the map for others.

### 3.4 Presence is live, not stored
The app deals in *now*. Presence signals (position + "tonight's vibe") are
ephemeral: a vibe tag expires after 3 hours, a dormant location is wiped after
24 hours, and nobody is shown at a location older than 2 hours. Discovery
finds people who have been *live recently*, not a static directory. This is a
deliberate identity choice ("live") and a privacy property (little is
retained).

---

## 4. A walk through the experience

**Onboarding.** The user lands on a sign-in screen. Before any entry is
possible they must tick a gate: *"I'm 16 or older and I accept the Terms of
Use and Privacy Notice."* They then sign in with **Apple** or **Google**, or
enter a no-account **demo mode** ("Explore the demo") that showcases the app
against a simulated city.

**The map.** They see their city (Luxembourg in the demo) with live event
pins and, if signed in, real nearby people. A horizontal row of interest chips
filters the view. A collapsed "time" pill at the bottom hides a **12-hour time
scrubber** — dragging it previews which events will be live later tonight
(morning joggers → evening crowds → night owls), while live people fade out
because the app never pretends to know where they'll be.

**Discovery.** The "People" tab has a **Discover** section: it lists everyone
within 50 km who shares the user's interests, ranked by overlap then distance,
each with a "N shared" badge. Tapping a match opens their card.

**Connection.** A person card shows distance, mode, and shared interests up
front. Because direct messaging is friends-only, a stranger's card offers
**Add friend**; once a request is accepted, chat unlocks. Two people who meet
in person can also do a **QR handshake**: one shows a QR "Deep Card," the other
scans it to send a request instantly.

**Events.** Users create **event pins** (drop a pin on the map → set activity,
title, time, place) which appear live for everyone. Others **join** them,
**chat** in a per-event thread, attach **photos ("vibe checks")**, and export
the event to their **calendar** or **share** it (links unfurl as rich cards
that deep-link back onto the map). An event card shows who's going; tapping an
attendee opens their profile.

**Meeting safely.** From any event, person, or friend, one tap gives **walking
directions** in Apple/Google Maps. **Guardian mode** lets a friend watch over
a meetup: they see the user's live position and get start/safe/SOS messages
and an overdue check-in warning.

**Remembering.** **Constellation** is the user's private city-memory, rendered
as an actual **night sky**: each month of meetups becomes a connect-the-dots
star figure named for its dominant interest ("The Guitarist," "The Runner"),
and the sky fills as months accumulate. A monthly recap can be rendered to an
image and shared.

**Managing yourself.** A profile menu (a full-height "You" sheet on phones)
groups everything: display name, Instagram handle, tonight's vibe, visibility,
avatar, interests, friends, meetups, safety tools, and account controls
including one-tap **account deletion**.

---

## 5. Feature catalogue

Grouped by where they sit on the ladder. Unless noted, features are backed by
the real backend for signed-in users; the demo mode simulates them locally.

### Presence & privacy
- **Visibility modes** (Ghost / Observer / Beacon), enforced server-side.
- **Tonight's vibe** — a transient interest tag (3 h) shown even on anonymous
  observer dots, never with name or photo.
- **Live presence on the map** — beacons show avatars, observers show
  anonymous dashed dots, friends are green-ringed.
- **Editable display name** — pick a real name or a nickname (privacy: you
  are not forced to show the name your OAuth provider handed over).
- **Custom emoji avatars**.

### Discovery
- **Interest filter chips** that dim non-matching pins.
- **Discover by shared interests within 50 km**, ranked by overlap + distance.
- **Universal search** (events / people / interests) with fly-to.
- **"You both" strips** — every profile leads with common ground.
- **Map layers** — All / Friends-only / Events-only.
- **Time scrubber** — preview the next 12 hours of events.

### Events
- **Event pins** — drop-a-pin composer (activity, title, time, place).
- **Address search & reverse geocoding** (Photon/OpenStreetMap, no API key).
- **Real attendance** — join/leave with live counts.
- **Per-event interest chat**.
- **Vibe checks 📸** — attendees attach photos (EXIF-stripped, compressed on
  device); a camera badge appears on the map pin.
- **Calendar export (ICS)** and **native / WhatsApp sharing** with rich-card
  unfurling and deep links back to the map.
- **Tappable attendee lists** — see who's going (filtered through the
  visibility ladder), tap through to profiles.

### Connection & messaging
- **Friends** — request / auto-accept-on-mutual / decline / remove, live-updating.
- **Direct messages** — 1:1 chat, friendship-gated, realtime, unread badges.
- **QR in-person handshake** ("Deep Card") — scan to connect.
- **Instagram handles** — optional, shown only to accepted friends.

### Safety & governance
- **Blocking** — bidirectional invisibility across map, search, events, messages.
- **Universal reporting** — report pins, photos, profiles, and conversations;
  reviewed within 24 h; reporter stays anonymous.
- **Guardian mode** — a friend watches over a meetup with live location + SOS.
- **Age gate** — 16+ confirmation required before sign-in.
- **Account deletion** — self-serve, server-side cascade.

### Memory
- **Constellation** — private city-memory as an evolving night-sky visual.
- **Monthly recap** — rendered to a shareable image.

---

## 6. Architecture

Deep Social is a **thin, static web client talking to a managed backend**,
wrapped in a native iOS shell. There is no custom application server — the
backend is Supabase, and all business logic that must be trusted lives in the
database as stored procedures with row-level security.

```
   ┌─────────────────────────────────────────────────────────┐
   │  CLIENTS                                                  │
   │   • Web app (GitHub Pages, static)                        │
   │   • iOS app (Capacitor shell wrapping the same web build) │
   └───────────────┬─────────────────────────────────────────┘
                   │  HTTPS / WebSocket (Supabase JS SDK)
   ┌───────────────▼─────────────────────────────────────────┐
   │  SUPABASE (managed backend)                              │
   │   • Postgres + PostGIS      (data + geospatial queries)  │
   │   • Row-Level Security      (per-user authorization)     │
   │   • Stored procedures (RPC) (all trusted logic)          │
   │   • Realtime                (live posts, presence, DMs)  │
   │   • Storage                 (vibe-check photos)          │
   │   • Auth                    (Google / Apple OAuth)       │
   │   • Edge Function `push`    (APNs notifications)         │
   └───────────────┬─────────────────────────────────────────┘
                   │
   ┌───────────────▼─────────────────────────────────────────┐
   │  EXTERNAL SERVICES (no keys, IP-only exposure)           │
   │   • CARTO / OpenStreetMap   (map tiles)                  │
   │   • Photon (komoot)         (address search/geocoding)   │
   │   • Apple Push (APNs)       (native notifications)       │
   └─────────────────────────────────────────────────────────┘
```

### 6.1 Frontend
- **Vite + React 18 + TypeScript**, single-page. No router and no global
  state library — the app is one root component (`App.tsx`) holding state in
  React hooks, with features rendered as modals/sheets over the map.
- **Leaflet** renders the map with custom HTML markers over dark CARTO tiles.
- **Plain CSS with design tokens** (a violet→cyan brand system), no CSS
  framework. Theming, mobile bottom sheets, and iOS safe-area handling are
  hand-rolled.
- **Component structure** (~24 components): `MapView`, `TopBar`, `SidePanel`,
  card/modal components per feature (event, person, friend profile, report,
  interests, guardian, constellation, etc.).
- **Service layer** (`src/services/`) wraps every backend call, geolocation,
  media processing, geocoding, sharing, calendar export, and push, so
  components never touch the SDK directly.

### 6.2 Demo simulation
A local **simulation engine** (`src/sim/`) stands in for the backend in demo
mode: it seeds a fictional city of members who roam and *head toward events
they plan to attend*, with attendee counts rising as they arrive. This makes
the app feel alive before any real network exists and lets an evaluator try it
with no account. All simulated people and content are now explicitly labelled
**"demo,"** and they automatically retract once ≥3 real members are nearby.

### 6.3 Backend (Supabase)
- **Postgres + PostGIS** stores all data; geospatial types and indexes power
  "who/what is near this point" queries.
- **Stored procedures (RPCs)** — ~40 functions — are the only way the client
  performs trusted operations (nearby queries, joining events, friending,
  messaging, reporting, etc.). Business rules live here, not in the client.
- **Row-Level Security (RLS)** governs every table: users can read/write only
  what they're entitled to, enforced by the database regardless of client
  behaviour.
- **Realtime** streams live changes (new/updated pins, presence heartbeats,
  message delivery) over WebSockets.
- **Storage** holds vibe-check photos (metadata stripped, compressed client
  side before upload).
- **Auth** handles Google and Apple OAuth; sessions persist in the browser.
- **Edge Function `push`** sends native push notifications via Apple's APNs
  (friend requests, messages, guardian alerts, and moderation reports).

The schema is delivered as **17 sequential SQL migrations** (`0001`–`0017`),
each independently applied and covered by an assertion-based smoke-test suite
that runs the full chain against a throwaway Postgres and verifies the
security properties (e.g. that raw coordinates and emails are unreadable, that
cross-user writes are blocked, that the visibility ladder holds).

### 6.4 Mobile (iOS)
The iOS app is a **Capacitor 7** shell wrapping the exact same web build,
using native plugins for **geolocation** (CoreLocation), **push
notifications** (APNs), an in-app **browser** (OAuth), and **app** lifecycle.
The web build is synced into the native project; the app is being prepared for
**TestFlight** distribution.

### 6.5 Hosting & delivery
The web client is a **static bundle on GitHub Pages**. **GitHub Actions**
provides CI/CD: every push builds, and deploys to Pages. Because the client is
static and the backend is managed, operating cost and attack surface are both
minimal.

---

## 7. Data model & privacy engineering

The privacy posture is not a policy bolted on top — it is implemented in the
database, which is worth understanding as an architectural strength.

- **Sensitive columns are never selectable by the client.** Raw coordinates
  (`last_location`) and email are excluded from the API role's column grants
  entirely. They are exposed *only* through specific stored procedures that
  apply rules first (e.g. `nearby_profiles` blurs an observer's location and
  withholds their identity before returning anything).
- **The visibility ladder is server-enforced.** Whether you appear, and with
  what precision and identity, is computed inside `nearby_profiles` from your
  mode and the viewer's friendship status — a modified client cannot reveal a
  Ghost or unmask an Observer.
- **Friends-only data stays friends-only structurally.** For example, an
  Instagram handle carries *no* read grant at all; it surfaces only through
  the "my friends" procedure, and only for *accepted* friendships. The
  attendee-list procedure similarly names friends/beacons but returns
  anonymous, id-withheld rows for ghosts/observers.
- **Blocking is bidirectional and invisible.** Blocked pairs disappear from
  each other everywhere; the blocked person is never told.
- **Reports are a tamper-resistant moderation log.** The reported user is
  resolved server-side (a client can't forge who it's reporting), reporter
  identity is never disclosed to the reported party, and rows are retained as
  the record of how each case was handled.
- **Retention is enforced, not promised.** A scheduled sweep
  (`run_data_retention`) prunes expired vibes, dormant locations, dead push
  tokens, old guardian sessions, and long-past events + photos — while
  refusing to delete anything under an open report.

---

## 8. Security & regulatory posture

The app is being built for EU launch, and the compliance work is part of the
product rather than an afterthought.

- **GDPR** — privacy-protective defaults (anonymous, location-blurred
  Observer by default; identification is opt-in; one-tap Ghost; no
  trackers/analytics/ads), server-enforced data minimisation, EXIF stripping,
  self-serve deletion, an enforced retention schedule, a per-operation
  legal-basis mapping (contract for the core service, consent only for
  location visibility and vibe, legitimate interest for safety), a documented
  breach-response playbook, and a bilingual (English/French) privacy notice.
- **Digital Services Act (DSA)** — universal notice-and-action reporting on
  every surface, a 24-hour review commitment with statements of reasons and a
  re-review path, and an operator moderation playbook. (Growth-triggered DSA
  duties like formal appeals and transparency reports are scoped but not yet
  built, as they don't bind micro-enterprises at this scale.)
- **Children** — a 16+ age gate (Luxembourg's GDPR age of digital consent),
  adult-oriented positioning, and no child-directed design; the app does not
  support under-16 use.
- **Apple App Store** — user-generated-content moderation controls (report +
  block), account deletion (Guideline 5.1.1), and export-compliance
  declaration are in place; the app targets a 17+ store rating.

Legal/compliance details live in `PRIVACY.md`, `TERMS.md`, and the operator
docs (`docs/MODERATION.md`, `docs/RETENTION.md`, `docs/BREACH.md`,
`docs/LEGAL-BASES.md`).

---

## 9. Status & roadmap

**Current status.** A functional beta: the web app is live, the full feature
set above works against the real backend for signed-in users, and the iOS app
is being prepared for TestFlight. Compliance groundwork (P0 + P1) is complete
in code.

**Simulated vs. real.** The "demo world" people, the ambient movement, and the
per-event chat participants are simulated (labelled as such). Everything a
signed-in user does with real accounts — presence, pins, attendance, photos,
friends, DMs, blocks, reports, guardian, memory — is backed by the live
backend.

**Deliberately deferred / parked** (design decisions, not omissions):
- **Monetisation** — two tracks scoped (end-user subscription: e.g. temporary
  visibility boosts, deeper memory, cosmetics; and business partners:
  promoted/verified venue pins). Not built; the guardrail is never to paywall
  the social graph or safety.
- **Navigation restructure** — a possible bottom tab-bar (Map · Discover ·
  Chats · You) is on hold until beta feedback shows which features earn a tab.
- **Meta (Facebook/Instagram) login**, phone-number sharing (rejected as
  retention-eroding + high-PII), and custom-domain universal links — all
  parked.

**Near-term operational tasks** (outside code): apply the latest migrations
to production, schedule the retention job, register the moderation contact,
finalise the App Store rating and privacy-label audit, and complete TestFlight
onboarding.

---

## 10. Glossary

| Term | Meaning |
|---|---|
| **Pin** | A marker on the map — an event, a person, or a place. |
| **Beacon / Observer / Ghost** | The three visibility modes, most to least visible. |
| **Vibe / Tonight's vibe** | A transient (3 h) interest tag on your presence. |
| **Vibe check** | A photo attached to an event pin. |
| **Deep Card** | The QR profile shown during an in-person handshake. |
| **Constellation** | The user's private night-sky map of everyone they've met and everything they've joined. |
| **Guardian** | A friend watching over your meetup with live location + SOS. |
| **Discover** | Finding people within 50 km who share your interests. |
| **RLS** | Row-Level Security — database-enforced per-user authorization. |
| **RPC** | A stored procedure the client calls to perform trusted operations. |
| **Demo mode** | No-account simulation of the app against a fictional city. |
