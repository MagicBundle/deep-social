# Pre-TestFlight launch checklist

Everything that must happen **outside the code** before opening the beta more
widely. Ordered by dependency — do the sections top to bottom. Tick as you go.

Legend: 🟢 = do now · 🔵 = Apple-side, can run in parallel · ⚪ = one-time confirm.

---

## A. Database migrations 🟢

Apply in the Supabase **SQL editor**, one file at a time, **in order**. Paste
the contents of each file and run it. Already applied earlier: `0013`, `0014`,
`0015` (an `already exists` error just means it's applied — skip it).

- [ ] `supabase/migrations/0016_reporting_age.sql` — universal reporting + age
- [ ] `supabase/migrations/0017_retention.sql` — retention sweep function
- [ ] `supabase/migrations/0018_observer_default.sql` — Observer is the default
- [ ] `supabase/migrations/0019_constellation_archive.sql` — Constellation fix

**Verify all four landed** — this should return all `true`:

```sql
select
  to_regprocedure('public.report_content(text,uuid,text)') is not null       as has_reporting,      -- 0016
  exists(select 1 from information_schema.columns
         where table_name='profiles' and column_name='age_confirmed_at')     as has_age_col,        -- 0016
  to_regclass('public.moderation_contacts') is not null                      as has_mod_contacts,   -- 0016
  to_regprocedure('public.run_data_retention()') is not null                 as has_retention,      -- 0017
  (select column_default like '%observer%' from information_schema.columns
   where table_name='profiles' and column_name='visibility_mode')           as observer_default,   -- 0018
  to_regclass('public.attended_archive') is not null                         as has_archive;        -- 0019
```

---

## B. Post-migration data setup 🟢

**B1. Register yourself as the moderation contact** (needs 0016). Find your id,
then insert it:

```sql
-- your user id (use the email you sign in with)
select id, email from public.profiles where email = 'YOUR_SIGNIN_EMAIL';

insert into public.moderation_contacts (user_id)
values ('PASTE_YOUR_UUID') on conflict do nothing;
```

- [ ] Moderation contact inserted (you'll now get a push on every report)

**B2. Schedule the retention sweep** (needs 0017). In the SQL editor:

```sql
create extension if not exists pg_cron;
select cron.schedule('deep-social-retention', '20 4 * * *',
  $$select public.run_data_retention();$$);
```

- [ ] Retention job scheduled (verify: `select * from cron.job;`)

> Note: pg_cron discards the photo paths the function returns, so pruned pins'
> *photo files* linger in the `vibes` bucket. Fine at beta scale — clear the
> bucket occasionally, or switch to the Actions-cron variant in
> `docs/RETENTION.md` later.

---

## C. Push notifications 🟢

- [ ] Confirm the APNs secrets still exist (set when push was first built):
      `APNS_BUNDLE_ID`, `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_KEY`
      (Dashboard → Edge Functions → Secrets, or `supabase secrets list`)
- [ ] Redeploy the push function (it gained the `report` alert kind):
      `supabase functions deploy push --no-verify-jwt`

---

## D. End-to-end verification 🟢

- [ ] From a **second** account, file a report against one of your pins →
      a row appears in `public.reports` (`status = 'open'`) **and** you get a
      "⚑ New content report" push.
- [ ] New sign-up appears on the map by default (Observer dot), and the
      profile menu shows visibility = Observer.
- [ ] Ticking the 16+ box is required before any sign-in button works.

---

## E. Apple / App Store Connect 🔵

- [ ] **Commit the pending Info.plist change** (`ITSAppUsesNonExemptEncryption
      = false`) — currently uncommitted in the working tree — then re-sync and
      archive, so the export-compliance declaration ships in the build.
- [ ] **Age rating → 17+** (App Store Connect → App Information).
- [ ] **Audit the App Privacy "nutrition label"** against reality: collects
      **Precise Location** (Observer/Beacon), **User Content** (pins, photos,
      messages), **Contact Info** (name/email), **Identifiers** (push token) —
      and **no tracking**, no third-party analytics/ads.
- [ ] **Support/contact URL & email** — a real address (DSA point-of-contact +
      Apple support field). GitHub Issues is the beta stand-in; replace when a
      domain lands.
- [ ] Archive in Xcode → upload → assign to TestFlight testers.

---

## F. One-time confirmations ⚪

- [x] **CARTO basemap key** — set in `.env.local` (local + iOS builds) and as
      the GitHub repository variable `VITE_CARTO_KEY` (Pages build), 2026-09-04.
      Keyed tile verified watermark-free. If CARTO ever rotates the key, update
      both places and push.
- [ ] **Supabase project region** (Dashboard → Project Settings →
      Infrastructure). If it's an EU region, the privacy notice's data-location
      story is clean. If US, decide before public launch (transfer story).
- [ ] Skim `docs/MODERATION.md`, `docs/BREACH.md`, `docs/RETENTION.md` so the
      operator playbooks are familiar before you need them.

---

### Quick status of what's already done (no action)

Live in code & deployed: the app, all features, hosted bilingual
privacy/terms, age gate (UI), reporting UI on every surface, Guardian
disclaimer, retention function, Observer-default schema. The items above are
the production wiring that turns them on.
