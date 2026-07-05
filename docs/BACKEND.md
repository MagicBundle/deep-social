# Data backbone — Supabase + PostGIS

Architecture for shared state (locations, pins, chat-ready), geospatial
querying, and realtime updates, on static hosting (GitHub Pages). Supabase
was chosen over Firebase for one decisive reason: **PostGIS**. "Everyone
within 5 km" is a first-class indexed query in Postgres, not a geohash
workaround.

```
┌─ GitHub Pages (static SPA) ─────────────────────────────┐
│  React UI                                               │
│  src/auth/        session + OAuth routing               │
│  src/services/db.ts   the ONLY file that speaks to ──┐  │
└──────────────────────────────────────────────────────┼──┘
                                                       ▼
┌─ Supabase project ──────────────────────────────────────┐
│  Auth (GoTrue): Google OAuth, PKCE, JWT sessions        │
│  PostgREST: RPCs only for geo (columns not selectable)  │
│  Postgres + PostGIS: profiles, posts, RLS               │
│  Realtime: postgres_changes (posts), Presence (live map)│
└─────────────────────────────────────────────────────────┘
```

## Schema (see [supabase/migrations/0001_init.sql](../supabase/migrations/0001_init.sql))

**profiles** — `id (uuid, = auth.users.id)`, `email`, `display_name`,
`avatar_url`, `interests text[]`, `location_sharing ('precise'|'fuzzed'|'off',
default 'off')`, `last_location geography(point,4326)`,
`location_updated_at`, timestamps. GiST index on `last_location`.

**posts** (event pins, since `0002_event_pins.sql`) — `id`, `user_id → profiles`,
`title (≤80)`, `category`, `starts_at`, `duration_min`, optional `content`
description (≤500), optional `venue` label (≤120, since `0003_pin_venue.sql`,
resolved client-side via Photon geocoding at creation), `location
geography(point,4326)`, `created_at`. GiST index on `location`. Created via
`create_event_pin(...)`; `nearby_posts` returns only pins that are upcoming
(next 48 h) or still ongoing.

**attendees** (since `0004_attendance_vibes.sql`) — `(post_id, user_id)` PK,
maintained via `join_meetup`/`leave_meetup` RPCs (idempotent); pin creators
auto-join. A definer trigger keeps a denormalized `posts.attendee_count`,
whose UPDATE broadcasts double as the realtime signal for count changes.
`nearby_posts` additionally returns the caller's `joined` flag and a
`media_count`.

**media_attachments** ("Vibe Checks", `0004`) — photos attached to pins:
`post_id`, `user_id`, `storage_path` (bucket `vibes`, path `<post_id>/<uuid>.jpg`),
`media_type` (image-only by check constraint). The insert policy is the
feature's core rule: **only current attendees of a pin can attach media** —
enforced both on the table RLS and again on the storage bucket's upload
policy (path's first segment must be a pin the uploader attends). Files are
canvas-re-encoded client-side before upload (≤1200 px JPEG: cost control,
format normalization, EXIF/GPS stripped). Bucket caps: 2 MB, image MIME only,
public read.

**reports** (`0004`) — prototype moderation: any signed-in user can report a
media item once (`report_media` RPC). API roles can *insert only* — no select
grant, so reports are readable exclusively from the dashboard/service role.

**friendships** (`0005_friends.sql`) — `(requester_id, addressee_id)` PK with
`status pending|accepted`. RPCs: `request_friend` (requesting someone who
already requested you auto-accepts), `respond_friend`, `remove_friend`,
`my_friendships` (profile-joined list with friend/incoming/outgoing state).
RLS scopes every row to its two participants — nobody else can see who is
friends with whom. In the realtime publication (RLS-filtered) so the Friends
tab updates live. Member search is a plain `ilike` on `profiles.display_name`
(safe columns only).

**direct_messages** (`0007_direct_messages.sql`) — 1:1 chat between accepted
friends. INSERT policy calls `are_friends()` (a `security definer` helper), so
you can only message someone you're actually friends with — a modified client
can't DM strangers. SELECT is scoped to the two participants. RPCs: `send_dm`,
`conversation` (thread, oldest-first, with a `mine` flag), `mark_dm_read`,
`dm_unread_counts` (per-friend badges). In the realtime publication so open
chats and unread badges update live.

`geography` (not `geometry`) so `ST_DWithin`/`ST_Distance` work in meters on
real-earth distances with index support.

## The auth-to-DB bridge

Two halves, both idempotent:

1. **Server (source of truth):** an `after insert on auth.users` trigger
   (`handle_new_user`) creates the profile row from OAuth metadata. A profile
   exists before the client's first query, always — even if the client dies
   mid-signup.
2. **Client (freshness):** on every `SIGNED_IN` event,
   `src/auth/supabase-auth.ts` upserts `display_name` / `avatar_url` / `email`
   so provider-side changes propagate. Failures log a warning and never block
   sign-in.

When Supabase env vars are present, Google sign-in switches from the
client-side GIS popup to `supabase.auth.signInWithOAuth` (PKCE redirect).
That is deliberate: only a Supabase-issued JWT makes `auth.uid()` — and thus
every RLS policy — work. The GIS popup remains the fallback (identity-only,
no DB), demo mode below that. `src/auth/index.ts` is the router.

## Spatial logic: "everyone within 5 km"

```sql
select * from nearby_profiles(48.8566, 2.3522, 5000);
```

Implemented with `ST_DWithin(last_location, origin, radius)` — planner uses
the GiST index — ordered by `ST_Distance`. The RPC (not a raw table read)
enforces, server-side:

- `location_sharing = 'off'` rows never appear;
- `'fuzzed'` rows are snapped to a ~500 m grid (`ST_SnapToGrid` — deterministic,
  so repeated queries can't average the jitter away);
- stale locations (> 2 h) are excluded;
- the caller is excluded from their own results;
- an index-assisted prefilter runs on the true column with an 800 m margin,
  then the exact filter runs on the (possibly fuzzed) shown location.

`nearby_posts(lat, lng, radius_m, max_age)` is the same pattern for pins,
newest-first, joined with author identity.

## Security architecture (RLS + column grants)

| Table | select | insert | update | delete |
| --- | --- | --- | --- | --- |
| profiles | any signed-in user, **safe columns only** (identity, interests, sharing tier — never `email`/`last_location`) | own row | own row (no coordinate columns in grant) | — (cascade from auth.users) |
| posts | any signed-in user | own (`user_id = auth.uid()`) | own, `content` only | own |

The unusual part is **column-level grants**: `last_location` and `email` are
excluded from the `authenticated` role's `select` grant entirely. Even with a
permissive row policy, `select last_location from profiles` fails with
`permission denied`. Coordinates exist for clients **only** through:

- `nearby_profiles(...)` — `security definer`, applies the privacy tiers;
- `get_my_profile()` — `security definer`, own row only (`auth.uid()`);
- `update_my_location(lat, lng)` — the only coordinate write path, own row only.

All RPCs revoke `execute` from `anon`. `security definer` functions pin
`search_path`. Client-side implication: always select explicit columns on
`profiles`, never `*`.

## Realtime

- **posts** are in the `supabase_realtime` publication → `subscribeToPosts()`
  in `db.ts` fires on any INSERT/DELETE (RLS-filtered), and the caller re-runs
  `getNearbyPins` for its viewport. That's "User A posts → User B's map
  updates, no refresh."
- **profiles is deliberately NOT in the publication**: change events carry
  full rows, which would leak raw `last_location` past the privacy tiers.
  Live member dots use **Realtime Presence** instead (`joinMapPresence` in
  `db.ts`): ephemeral, opt-in by joining the channel, nothing persisted, and
  the client only broadcasts coordinates already degraded to its own tier.

## Going live (one-time, ~10 min)

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard) (free tier).
2. SQL editor → paste [supabase/migrations/0001_init.sql](../supabase/migrations/0001_init.sql) → Run.
3. Auth → Providers → Google: enable, using the existing Google client id +
   a client secret from the same Google Cloud credentials page. Add the
   callback URL Supabase shows you to the Google client's **Authorized
   redirect URIs**.
4. Auth → URL Configuration: Site URL `https://magicbundle.github.io/deep-social/`,
   additional redirect URL `http://localhost:5173`.
5. Project Settings → API: copy URL + anon key, then:

   ```bash
   gh variable set VITE_SUPABASE_URL --body '<project-url>'
   gh variable set VITE_SUPABASE_ANON_KEY --body '<anon-key>'
   git commit --allow-empty -m 'Redeploy with data backbone' && git push
   ```

   For local dev, put the same two values in `.env.local`.

The anon key is publishable by design — RLS is the security boundary. The
`service_role` key is the dangerous one: it never belongs in this repo or
bundle.

## What this unlocks next

Replace `useSimulation`'s members with `getNearbyProfiles` + `joinMapPresence`
data, pin posts to the map via `getNearbyPins` + `subscribeToPosts`, and move
event chat onto Realtime channels — the UI contract (`World`, `Session`)
doesn't change.
