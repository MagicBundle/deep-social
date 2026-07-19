# Deep Social — Privacy Notice (Beta)

*Last updated: July 2026*

Deep Social is a **hobby project in beta testing**. It is not a commercial
service. This notice explains, in plain language, what data the app handles
so you can decide whether to participate. See also the [Terms of Use](TERMS.md).

Most processing happens because it **is the service you signed up for**
(your profile, pins, photos, messages — GDPR "performance of a contract").
By default you appear to people nearby as an **anonymous Observer** — your
interests only, no name or photo, location blurred to ~500 m — which we rely
on our **legitimate interest** in making a social-discovery map useful; you
can become invisible (**Ghost**) with one tap at any time. Two things run on
your **explicit, revocable consent**: being fully identified to strangers
(**Beacon**) and broadcasting a "tonight's vibe". Safety features (blocks,
reports, the moderation log) rest on our **legitimate interest** in keeping
the service safe. The service is **16+**; your age confirmation at sign-in is
recorded as required evidence.

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
- **Your block list** — the users you've blocked. It is visible **only to you**
  and is **never disclosed to the blocked person** (they aren't told).
- **Reports you file** (what you reported, the reason you gave, and when).
  Reports are visible only to the operator, never to the reported person —
  and they are never told who reported them. Reports are kept while the case
  is open and as evidence of how it was handled.
- **The date you confirmed being 16 or older** at sign-in — stored once on
  your profile as required evidence of that check.
- **A device push token**, if you use the iOS app and allow notifications —
  an anonymous identifier from Apple used only to deliver your own alerts
  (friend requests, messages, guardian check-ins). It is removed on sign-out.
- **"Tonight's vibe"**, if you set one — a single transient tag that expires
  after ~3 hours. It is shown to people nearby, including when you are in
  anonymous Observer mode (it never includes your name or photo). While you
  are visible (Observer/Beacon), the app also sends periodic ephemeral
  presence signals (position at your chosen precision + vibe) that are not
  stored as a movement history.

## Your location and who can see you

You control this any time in Profile → Privacy & visibility. There are three
modes; the map centres on you inside your browser regardless of which you pick.

- **Ghost** — invisible to strangers, and **nothing about your location is
  uploaded**.
- **Observer** *(the default)* — you appear to nearby strangers as an
  anonymous dot showing only your interests; your name and photo are withheld
  and your shown location is blurred to ~500 m. Your precise position *is*
  uploaded, but only so accepted friends can find you — it is never shown to
  strangers.
- **Beacon** — your full profile and precise location are visible to people
  nearby.

Accepted connections always see your full profile and precise location
regardless of this setting.

## What we do NOT do

- No analytics, no advertising trackers, no cookies beyond a login session
  stored in your own browser (localStorage).
- We never sell or share data with third parties for their own purposes.

## Where the data lives (processors)

- **Supabase** (database, authentication, photo storage) — hosts all app data.
- **GitHub Pages** — serves the app itself (static files only).
- Map tiles are loaded from **CARTO/OpenStreetMap** and address search uses
  **Photon (komoot.io)**; these services see your IP address and, for address
  search, the text you type into the location search box — like any map
  website.

## How long data is kept

An automatic daily clean-up enforces these limits:

- **"Tonight's vibe"** — gone after 3 hours.
- **Your last map position** — hidden from others after 2 hours, wiped from
  the database after 24 hours of inactivity.
- **Push tokens** — deleted on sign-out, or after 60 days without use.
- **Guardian sessions** — ended sessions deleted after 30 days.
- **Event pins and their photos** — deleted 30 days after the event ends
  (kept longer only while a report about them is still being handled).
- **Messages, friendships, profile** — kept until you delete your account,
  which removes them in one cascade.
- **Reports** — kept as the moderation record of how each case was handled.

## Your rights (GDPR-style)

Beta data is not sacred: **the database may be reset at any time** during
testing. At any time you can request:

- a copy of your data,
- correction of your data,
- **complete deletion** — this is now **self-serve**: profile menu → **Delete
  account**. It runs a server-side cascade that removes your profile, your event
  pins, your photos' database records, your attendance, your friendships, your
  direct messages, and your archived event memories (Constellation). (Photo
  *files* in storage are cleared manually during beta.)

For a copy or correction of your data — or deletion if you can't sign in — open
an issue at
[github.com/MagicBundle/deep-social/issues](https://github.com/MagicBundle/deep-social/issues)
or contact the repository owner. Those requests are handled manually during
beta, and remember that beta data may be reset at any time regardless.

## Disclaimer

This is good-faith transparency for a small beta, written by the project
author — it is not legal advice, and the beta is provided as-is, without
warranty. If the project grows beyond friendly testing, this notice will be
replaced by a proper policy (and self-serve data export/deletion).
