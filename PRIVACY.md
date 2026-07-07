# Deep Social — Privacy Notice (Beta)

*Last updated: July 2026*

Deep Social is a **hobby project in beta testing**. It is not a commercial
service. This notice explains, in plain language, what data the app handles
so you can decide whether to participate. By signing in you consent to the
processing described here.

## What we store when you sign in with Google

- Your **name, email address, and profile photo URL**, as provided by Google
  at sign-in. That's all — no contacts, no calendar, no other Google data.
- Your email is stored but **never shown to other users** (this is enforced
  at the database permission level, not just in the interface).

## What we store when you use the app

- **Event pins** you create: title, activity type, time, optional description
  and venue label, and the pin's map coordinates. Pins are visible to all
  signed-in users.
- **Photos ("vibe checks")** you attach to events. Photos are compressed on
  your device before upload and **all metadata (including embedded GPS
  coordinates) is stripped**. Photos are publicly accessible to anyone with
  the link and visible to all signed-in users.
- **Attendance** (which events you joined) — visible to all signed-in users
  as counts and to the event's participants.
- **Friendships and friend requests** — visible only to the two people
  involved; nobody else can query who is friends with whom.
- **Chosen avatar emoji and interests**, if you set them.

## What we do NOT do

- No analytics, no advertising trackers, no cookies beyond a login session
  stored in your own browser (localStorage).
- Your **device location is never uploaded** unless you opt in. It is used
  inside your browser to center the map. Visibility to other people is
  **off by default** ("Ghost" mode) and you control it in Profile → Privacy
  & visibility:
  - **Ghost** — invisible to strangers (default).
  - **Observer** — you appear as an anonymous dot showing only your interests;
    your name and photo are withheld and your location is blurred to ~500 m.
  - **Beacon** — your full profile and precise location are visible to people
    nearby.
  Accepted connections always see your full profile regardless of this setting.
- We never sell or share data with third parties for their own purposes.

## Where the data lives (processors)

- **Supabase** (database, authentication, photo storage) — hosts all app data.
- **GitHub Pages** — serves the app itself (static files only).
- Map tiles are loaded from **CARTO/OpenStreetMap** and address search uses
  **Photon (komoot.io)**; these services see your IP address and, for address
  search, the text you type into the location search box — like any map
  website.

## Your rights (GDPR-style)

Beta data is not sacred: **the database may be reset at any time** during
testing. At any time you can request:

- a copy of your data,
- correction of your data,
- **complete deletion** — deleting your account removes your profile, pins,
  photos, attendance, and friendships in one cascade.

To exercise any of these, open an issue at
[github.com/MagicBundle/deep-social/issues](https://github.com/MagicBundle/deep-social/issues)
or contact the repository owner. Requests are handled manually during beta.

## Disclaimer

This is good-faith transparency for a small beta, written by the project
author — it is not legal advice, and the beta is provided as-is, without
warranty. If the project grows beyond friendly testing, this notice will be
replaced by a proper policy (and self-serve data export/deletion).
