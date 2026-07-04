-- Smoke tests for supabase/migrations/0001_init.sql
-- Every check raises on failure; a clean run prints only PASS notices.

\set ON_ERROR_STOP on

-- ── seed users (trigger must create profiles) ──────────────────────────
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.com',
   '{"full_name": "Alice", "avatar_url": "https://x/a.png"}'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@example.com',
   '{"name": "Bob"}'),
  ('00000000-0000-0000-0000-00000000000c', 'carol@example.com', '{}'),
  ('00000000-0000-0000-0000-00000000000d', 'dave@example.com', '{}');

do $$
declare n int;
begin
  select count(*) into n from public.profiles;
  if n <> 4 then raise exception 'FAIL trigger: expected 4 profiles, got %', n; end if;
  if (select display_name from public.profiles where email = 'alice@example.com') <> 'Alice'
    then raise exception 'FAIL trigger: full_name mapping'; end if;
  if (select display_name from public.profiles where email = 'carol@example.com') <> 'carol'
    then raise exception 'FAIL trigger: email-prefix fallback'; end if;
  raise notice 'PASS: signup trigger creates profiles with metadata mapping';
end $$;

-- ── locations ───────────────────────────────────────────────────────────
-- Origin: Paris center (48.8566, 2.3522).
-- Alice: at origin, precise. Bob: ~1 km east, precise.
-- Carol: ~1 km north (off-grid coords), fuzzed. Dave: ~10 km east, precise.

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select public.update_my_location(48.8566, 2.3522);
update public.profiles set location_sharing = 'precise' where id = auth.uid();

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select public.update_my_location(48.8566, 2.365866);
update public.profiles set location_sharing = 'precise' where id = auth.uid();

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
select public.update_my_location(48.865623, 2.348912);
update public.profiles set location_sharing = 'fuzzed' where id = auth.uid();

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', false);
select public.update_my_location(48.8566, 2.488861);
update public.profiles set location_sharing = 'precise' where id = auth.uid();

-- Viewer = Alice, querying 5 km around the origin.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);

do $$
declare
  bob record; carol record; n int;
begin
  select count(*) into n from public.nearby_profiles(48.8566, 2.3522, 5000);
  if n <> 2 then raise exception 'FAIL nearby: expected 2 rows (bob, carol), got %', n; end if;

  select * into bob from public.nearby_profiles(48.8566, 2.3522, 5000) where display_name = 'Bob';
  if bob is null then raise exception 'FAIL nearby: Bob missing'; end if;
  if bob.distance_m not between 950 and 1050
    then raise exception 'FAIL nearby: Bob distance % not ~1000 m', bob.distance_m; end if;
  if abs(bob.lat - 48.8566) > 1e-9 or abs(bob.lng - 2.365866) > 1e-9
    then raise exception 'FAIL nearby: precise tier must return exact coords'; end if;

  select * into carol from public.nearby_profiles(48.8566, 2.3522, 5000) where display_name = 'carol';
  if carol is null then raise exception 'FAIL nearby: fuzzed Carol missing'; end if;
  if carol.lat = 48.865623 and carol.lng = 2.348912
    then raise exception 'FAIL nearby: fuzzed tier returned exact coords'; end if;
  if abs(carol.lat - 48.865623) > 0.005 or abs(carol.lng - 2.348912) > 0.005
    then raise exception 'FAIL nearby: fuzz moved point too far'; end if;

  if exists (select 1 from public.nearby_profiles(48.8566, 2.3522, 5000) where display_name = 'Alice')
    then raise exception 'FAIL nearby: caller must be excluded from own results'; end if;

  -- Dave is ~10 km out: outside 5 km, inside 15 km.
  if exists (select 1 from public.nearby_profiles(48.8566, 2.3522, 5000) where display_name = 'dave')
    then raise exception 'FAIL nearby: 10 km user leaked into 5 km radius'; end if;
  if not exists (select 1 from public.nearby_profiles(48.8566, 2.3522, 15000) where display_name = 'dave')
    then raise exception 'FAIL nearby: 10 km user missing from 15 km radius'; end if;

  raise notice 'PASS: nearby_profiles (radius, distances, precise/fuzzed tiers, self-exclusion)';
end $$;

-- Sharing 'off' disappears from results.
do $$
begin
  update public.profiles set location_sharing = 'off'
   where id = '00000000-0000-0000-0000-00000000000b';
  if exists (select 1 from public.nearby_profiles(48.8566, 2.3522, 5000) where display_name = 'Bob')
    then raise exception 'FAIL privacy: sharing=off user still listed'; end if;
  update public.profiles set location_sharing = 'precise'
   where id = '00000000-0000-0000-0000-00000000000b';
  raise notice 'PASS: location_sharing = off excludes user';
end $$;

-- Stale locations (>2 h) disappear.
do $$
begin
  update public.profiles set location_updated_at = now() - interval '3 hours'
   where id = '00000000-0000-0000-0000-00000000000b';
  if exists (select 1 from public.nearby_profiles(48.8566, 2.3522, 5000) where display_name = 'Bob')
    then raise exception 'FAIL freshness: stale location still listed'; end if;
  update public.profiles set location_updated_at = now()
   where id = '00000000-0000-0000-0000-00000000000b';
  raise notice 'PASS: 2-hour freshness window enforced';
end $$;

-- ── event pins ──────────────────────────────────────────────────────────
do $$
declare pid uuid; p record;
begin
  pid := public.create_event_pin('Sunset run — river loop', 'running', 48.8639, 2.3136,
                                 now() + interval '30 minutes', 90, 'Easy pace, all welcome',
                                 'Pont Alexandre III, Paris');
  select * into p from public.nearby_posts(48.8566, 2.3522, 5000) limit 1;
  if p.id is distinct from pid then raise exception 'FAIL pins: created pin not returned'; end if;
  if p.title <> 'Sunset run — river loop' or p.category <> 'running' or p.duration_min <> 90
    then raise exception 'FAIL pins: structured fields wrong'; end if;
  if p.venue <> 'Pont Alexandre III, Paris'
    then raise exception 'FAIL pins: venue not persisted (%)', p.venue; end if;
  if p.author_name <> 'Alice' then raise exception 'FAIL pins: author join wrong (%)', p.author_name; end if;
  if p.distance_m not between 2500 and 3500
    then raise exception 'FAIL pins: distance % outside sanity band', p.distance_m; end if;
  if exists (select 1 from public.nearby_posts(48.8566, 2.3522, 500))
    then raise exception 'FAIL pins: pin leaked into 500 m radius'; end if;

  -- lifecycle: ended pins disappear, ongoing pins stay
  update public.posts set starts_at = now() - interval '5 hours', duration_min = 60 where id = pid;
  if exists (select 1 from public.nearby_posts(48.8566, 2.3522, 5000) where id = pid)
    then raise exception 'FAIL pins: ended pin still visible'; end if;
  update public.posts set starts_at = now() - interval '30 minutes', duration_min = 120 where id = pid;
  if not exists (select 1 from public.nearby_posts(48.8566, 2.3522, 5000) where id = pid)
    then raise exception 'FAIL pins: ongoing pin missing'; end if;
  raise notice 'PASS: create_event_pin + nearby_posts (fields, author, distance, lifecycle)';
end $$;

-- ── attendance + vibe checks (0004) ─────────────────────────────────────
do $$
declare pid uuid; n int;
begin
  select id into pid from public.posts where title = 'Sunset run — river loop';
  -- creator auto-joined
  if not exists (select 1 from public.attendees
                 where post_id = pid and user_id = '00000000-0000-0000-0000-00000000000a')
    then raise exception 'FAIL attendance: creator not auto-joined'; end if;
  if (select attendee_count from public.posts where id = pid) <> 1
    then raise exception 'FAIL attendance: initial count wrong'; end if;
  raise notice 'PASS: pin creator auto-joined with correct count';
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);

do $$
declare pid uuid; n int; mid uuid;
begin
  select id into pid from public.posts where title = 'Sunset run — river loop';

  n := public.join_meetup(pid);
  if n <> 2 then raise exception 'FAIL attendance: join count % (want 2)', n; end if;
  n := public.join_meetup(pid);  -- idempotent
  if n <> 2 then raise exception 'FAIL attendance: duplicate join changed count to %', n; end if;
  if not (select np.joined from public.nearby_posts(48.8566, 2.3522, 5000) np where np.id = pid)
    then raise exception 'FAIL attendance: joined flag false for attendee'; end if;

  -- attendee can post a vibe
  mid := public.add_vibe_media(pid, pid::text || '/test-vibe.jpg');
  if (select np.media_count from public.nearby_posts(48.8566, 2.3522, 5000) np where np.id = pid) <> 1
    then raise exception 'FAIL vibes: media_count wrong'; end if;

  n := public.leave_meetup(pid);
  if n <> 1 then raise exception 'FAIL attendance: leave count % (want 1)', n; end if;
  raise notice 'PASS: join/leave lifecycle, joined flag, attendee vibe upload';
end $$;

-- non-attendee is blocked from posting vibes
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);

do $$
declare pid uuid; ok boolean := false; mid uuid;
begin
  select id into pid from public.posts where title = 'Sunset run — river loop';
  begin
    perform public.add_vibe_media(pid, pid::text || '/intruder.jpg');
  exception when insufficient_privilege then ok := true;
  end;
  if not ok then raise exception 'FAIL vibes: non-attendee could attach media'; end if;

  -- but anyone signed in can report media
  select id into mid from public.media_attachments limit 1;
  perform public.report_media(mid, 'test report');
  perform public.report_media(mid, 'duplicate should no-op');
  raise notice 'PASS: non-attendee blocked from vibes, reporting works';
end $$;

reset role;

do $$
begin
  if (select count(*) from public.reports) <> 1
    then raise exception 'FAIL reports: expected exactly 1 report row'; end if;
  raise notice 'PASS: report row persisted once (dupe ignored)';
end $$;

-- ── friendships (0005) ──────────────────────────────────────────────────
set role authenticated;

do $$
declare s text; n int;
begin
  -- Bob requests Alice
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
  s := public.request_friend('00000000-0000-0000-0000-00000000000a');
  if s <> 'pending' then raise exception 'FAIL friends: request status % (want pending)', s; end if;
  s := public.request_friend('00000000-0000-0000-0000-00000000000a'); -- idempotent
  if s <> 'pending' then raise exception 'FAIL friends: duplicate request status %', s; end if;

  -- Alice sees it incoming; requesting back auto-accepts
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
  if (select mf.state from public.my_friendships() mf where mf.display_name = 'Bob') <> 'incoming'
    then raise exception 'FAIL friends: Alice missing incoming request'; end if;
  s := public.request_friend('00000000-0000-0000-0000-00000000000b');
  if s <> 'accepted' then raise exception 'FAIL friends: counter-request gave % (want accepted)', s; end if;
  if (select mf.state from public.my_friendships() mf where mf.display_name = 'Bob') <> 'friend'
    then raise exception 'FAIL friends: not friends after mutual request'; end if;

  -- Carol requests Alice; Alice declines; row gone for both
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
  perform public.request_friend('00000000-0000-0000-0000-00000000000a');
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
  perform public.respond_friend('00000000-0000-0000-0000-00000000000c', false);
  select count(*) into n from public.my_friendships() mf where mf.display_name = 'carol';
  if n <> 0 then raise exception 'FAIL friends: declined request still visible'; end if;

  -- Uninvolved user sees nothing (RLS)
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', false);
  select count(*) into n from public.friendships;
  if n <> 0 then raise exception 'FAIL friends: outsider can see % friendship rows', n; end if;

  -- Removal works from either side
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
  perform public.remove_friend('00000000-0000-0000-0000-00000000000a');
  select count(*) into n from public.my_friendships();
  if n <> 0 then raise exception 'FAIL friends: friendship survived removal'; end if;

  raise notice 'PASS: friend request/auto-accept/decline/remove + RLS isolation';
end $$;

reset role;

-- ── RLS + column grants (as the API role) ───────────────────────────────
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);

do $$
declare n int; ok boolean := false;
begin
  -- raw coordinates and email must be unreadable, even with a valid session
  begin
    perform last_location from public.profiles limit 1;
  exception when insufficient_privilege then ok := true;
  end;
  if not ok then raise exception 'FAIL grants: last_location selectable by API role'; end if;
  ok := false;
  begin
    perform email from public.profiles limit 1;
  exception when insufficient_privilege then ok := true;
  end;
  if not ok then raise exception 'FAIL grants: email selectable by API role'; end if;

  -- safe columns remain readable
  select count(*) into n from public.profiles;
  if n <> 4 then raise exception 'FAIL rls: signed-in read of safe columns broken'; end if;
  raise notice 'PASS: column grants hide last_location/email from API role';
end $$;

do $$
declare n int;
begin
  -- Bob cannot update Alice's profile (0 rows affected under RLS)
  update public.profiles set display_name = 'HACKED'
   where id = '00000000-0000-0000-0000-00000000000a';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL rls: cross-user profile update affected % rows', n; end if;

  -- Bob cannot forge a post as Alice
  begin
    insert into public.posts (user_id, content, location)
    values ('00000000-0000-0000-0000-00000000000a', 'forged',
            extensions.st_setsrid(extensions.st_makepoint(2.35, 48.85), 4326)::extensions.geography);
    raise exception 'FAIL rls: forged post accepted';
  exception when insufficient_privilege or check_violation then null;
  end;

  -- Bob CAN post as himself through the RPC
  perform public.create_event_pin('bob pin', 'food', 48.857, 2.353);
  raise notice 'PASS: RLS blocks cross-user writes, allows own writes';
end $$;

reset role;
select 'ALL BACKBONE SMOKE TESTS PASSED' as result;
