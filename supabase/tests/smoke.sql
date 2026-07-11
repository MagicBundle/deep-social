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

-- ── locations & visibility ──────────────────────────────────────────────
-- Origin: Paris center (48.8566, 2.3522).
-- Bob: ~1 km east, beacon. Carol: ~1 km north, observer (with interests).
-- Dave: ~10 km east, beacon. Alice (viewer): at origin, beacon.

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select public.update_my_location(48.8566, 2.3522);
update public.profiles set visibility_mode = 'beacon' where id = auth.uid();

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select public.update_my_location(48.8566, 2.365866);
update public.profiles set visibility_mode = 'beacon' where id = auth.uid();

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
select public.update_my_location(48.865623, 2.348912);
update public.profiles set visibility_mode = 'observer', interests = '{art,music}' where id = auth.uid();

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', false);
select public.update_my_location(48.8566, 2.488861);
update public.profiles set visibility_mode = 'beacon' where id = auth.uid();

-- Viewer = Alice (not friends with anyone yet), querying 5 km around origin.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);

do $$
declare bob record; carol record; n int;
begin
  select count(*) into n from public.nearby_profiles(48.8566, 2.3522, 5000);
  if n <> 2 then raise exception 'FAIL nearby: expected 2 rows (bob, carol), got %', n; end if;

  -- Bob = beacon: identified, real name, exact coords
  select * into bob from public.nearby_profiles(48.8566, 2.3522, 5000) where is_friend = false and identified = true;
  if bob.display_name <> 'Bob' then raise exception 'FAIL nearby: beacon name wrong (%)', bob.display_name; end if;
  if abs(bob.lat - 48.8566) > 1e-9 or abs(bob.lng - 2.365866) > 1e-9
    then raise exception 'FAIL nearby: beacon must return exact coords'; end if;

  -- Carol = observer: anonymous (no name/photo), interests shown, fuzzed coords
  select * into carol from public.nearby_profiles(48.8566, 2.3522, 5000) where identified = false;
  if carol.display_name is not null then raise exception 'FAIL nearby: observer leaked name'; end if;
  if carol.avatar_url is not null or carol.avatar_emoji is not null
    then raise exception 'FAIL nearby: observer leaked avatar'; end if;
  if not (carol.interests @> array['art','music']) then raise exception 'FAIL nearby: observer interests missing'; end if;
  if carol.lat = 48.865623 and carol.lng = 2.348912
    then raise exception 'FAIL nearby: observer returned exact coords'; end if;

  -- self excluded, distance radius honored
  if exists (select 1 from public.nearby_profiles(48.8566, 2.3522, 5000) where display_name = 'Alice')
    then raise exception 'FAIL nearby: caller not excluded'; end if;
  if exists (select 1 from public.nearby_profiles(48.8566, 2.3522, 5000) where distance_m > 5000)
    then raise exception 'FAIL nearby: 10 km user leaked into 5 km radius'; end if;
  if not exists (select 1 from public.nearby_profiles(48.8566, 2.3522, 15000) where distance_m between 9000 and 11000)
    then raise exception 'FAIL nearby: 10 km user missing from 15 km radius'; end if;

  raise notice 'PASS: nearby_profiles (beacon full, observer anonymized, radius, self-exclusion)';
end $$;

-- Ghost disappears from strangers.
do $$
begin
  update public.profiles set visibility_mode = 'ghost'
   where id = '00000000-0000-0000-0000-00000000000b';
  if exists (select 1 from public.nearby_profiles(48.8566, 2.3522, 5000) where lat = 48.8566 and lng = 2.365866)
    then raise exception 'FAIL privacy: ghost user still listed to stranger'; end if;
  update public.profiles set visibility_mode = 'beacon'
   where id = '00000000-0000-0000-0000-00000000000b';
  raise notice 'PASS: ghost mode hides user from strangers';
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

-- ── pin rate limit + avatar emoji (0006) ────────────────────────────────
do $$
declare i int; ok boolean := false;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
  for i in 1..3 loop
    perform public.create_event_pin('carol pin ' || i, 'yoga', 49.61 + i * 0.001, 6.13);
  end loop;
  begin
    perform public.create_event_pin('carol pin 4', 'yoga', 49.62, 6.13);
  exception when others then
    if sqlerrm like '%daily pin limit%' then ok := true; end if;
  end;
  if not ok then raise exception 'FAIL limits: 4th pin in 24h was accepted'; end if;

  -- avatar emoji: settable on own row, visible through my_friendships
  update public.profiles set avatar_emoji = '🦊' where id = auth.uid();
  perform public.request_friend('00000000-0000-0000-0000-00000000000d');
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', false);
  if (select mf.avatar_emoji from public.my_friendships() mf where mf.state = 'incoming' limit 1) <> '🦊'
    then raise exception 'FAIL avatars: emoji not visible in my_friendships'; end if;
  raise notice 'PASS: 3-per-day pin limit enforced, avatar emoji flows to friends';
end $$;

-- ── direct messages (0007) ──────────────────────────────────────────────
do $$
declare mid uuid; n int; ok boolean := false; s text;
begin
  -- Establish an accepted friendship: Bob <-> Alice
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
  perform public.request_friend('00000000-0000-0000-0000-00000000000a');
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
  s := public.request_friend('00000000-0000-0000-0000-00000000000b');
  if s <> 'accepted' then raise exception 'FAIL dm-setup: friendship not accepted (%)', s; end if;

  -- Bob DMs Alice
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
  mid := public.send_dm('00000000-0000-0000-0000-00000000000a', 'hey Alice, coffee?');
  if mid is null then raise exception 'FAIL dm: send returned null'; end if;

  -- Alice sees it, flagged not-mine, and appears unread for her
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
  select count(*) into n from public.conversation('00000000-0000-0000-0000-00000000000b');
  if n <> 1 then raise exception 'FAIL dm: Alice sees % messages (want 1)', n; end if;
  if (select c.mine from public.conversation('00000000-0000-0000-0000-00000000000b') c limit 1)
    then raise exception 'FAIL dm: incoming message flagged as mine'; end if;
  if (select du.unread from public.dm_unread_counts() du
       where du.friend_id = '00000000-0000-0000-0000-00000000000b') <> 1
    then raise exception 'FAIL dm: unread count wrong'; end if;

  -- Alice replies; both see the 2-message thread; mark read clears unread
  perform public.send_dm('00000000-0000-0000-0000-00000000000b', 'yes! 4pm?');
  perform public.mark_dm_read('00000000-0000-0000-0000-00000000000b');
  if exists (select 1 from public.dm_unread_counts())
    then raise exception 'FAIL dm: unread not cleared after mark_dm_read'; end if;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
  select count(*) into n from public.conversation('00000000-0000-0000-0000-00000000000a');
  if n <> 2 then raise exception 'FAIL dm: Bob sees % messages (want 2)', n; end if;

  -- Non-friend (Carol) cannot DM Bob
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
  begin
    perform public.send_dm('00000000-0000-0000-0000-00000000000b', 'let me in');
  exception when others then
    if sqlerrm like '%accepted friends%' or sqlerrm like '%policy%' then ok := true; end if;
  end;
  if not ok then raise exception 'FAIL dm: non-friend was able to send a DM'; end if;

  -- And cannot read someone else's thread (RLS)
  select count(*) into n from public.conversation('00000000-0000-0000-0000-00000000000a');
  if n <> 0 then raise exception 'FAIL dm: outsider read % messages from a thread', n; end if;

  raise notice 'PASS: DM send/receive, unread + mark-read, friendship gate, RLS isolation';
end $$;

reset role;

-- ── visibility friends-bypass (0008) ────────────────────────────────────
-- Runs as superuser so the cross-user visibility_mode setup actually applies
-- (under the authenticated role, RLS would silently no-op those updates and
-- the assertions would be vacuous). auth.uid() still follows the GUC.
-- Bob & Alice are accepted friends (from the DM setup). Bob is ~1 km east.
do $$
declare bob record;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);

  -- Bob observer, but Alice is his friend → she sees him identified + precise
  update public.profiles set visibility_mode = 'observer' where id = '00000000-0000-0000-0000-00000000000b';
  select * into bob from public.nearby_profiles(48.8566, 2.3522, 5000) where is_friend = true;
  if bob is null then raise exception 'FAIL bypass: friend not returned'; end if;
  if not bob.identified then raise exception 'FAIL bypass: friend in observer mode not identified'; end if;
  if bob.display_name <> 'Bob' then raise exception 'FAIL bypass: friend name hidden (%)', bob.display_name; end if;
  if abs(bob.lat - 48.8566) > 1e-9 then raise exception 'FAIL bypass: friend location fuzzed'; end if;

  -- Bob ghost, but friends still see him (chosen rule)
  update public.profiles set visibility_mode = 'ghost' where id = '00000000-0000-0000-0000-00000000000b';
  if not exists (select 1 from public.nearby_profiles(48.8566, 2.3522, 5000) where is_friend = true)
    then raise exception 'FAIL bypass: friend hidden in ghost mode'; end if;

  update public.profiles set visibility_mode = 'beacon' where id = '00000000-0000-0000-0000-00000000000b';
  raise notice 'PASS: friends bypass visibility (see observer/ghost friend as full)';
end $$;

-- ── vibes (0009) ────────────────────────────────────────────────────────
do $$
declare v text;
begin
  -- Bob (beacon) sets a vibe; Alice sees it
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
  update public.profiles set current_vibe = 'music', vibe_set_at = now() where id = auth.uid();
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
  select np.vibe into v from public.nearby_profiles(48.8566, 2.3522, 5000) np
   where np.display_name = 'Bob';
  if v is distinct from 'music' then raise exception 'FAIL vibes: beacon vibe not visible (%)', v; end if;

  -- Carol is an observer: anonymous, but her vibe still shows
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
  update public.profiles set current_vibe = 'art', vibe_set_at = now(),
         location_updated_at = now() where id = auth.uid();
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
  select np.vibe into v from public.nearby_profiles(48.8566, 2.3522, 5000) np
   where np.identified = false;
  if v is distinct from 'art' then raise exception 'FAIL vibes: observer vibe not visible (%)', v; end if;

  -- Expiry: a 4-hour-old vibe reads as null
  update public.profiles set vibe_set_at = now() - interval '4 hours'
   where id = '00000000-0000-0000-0000-00000000000b';
  select np.vibe into v from public.nearby_profiles(48.8566, 2.3522, 5000) np
   where np.display_name = 'Bob';
  if v is not null then raise exception 'FAIL vibes: expired vibe still visible (%)', v; end if;

  raise notice 'PASS: vibes visible (beacon + anonymous observer), 3h expiry enforced';
end $$;

-- ── blocks + account deletion (0010) ────────────────────────────────────
-- Runs as superuser for cross-user assertions; auth.uid() follows the GUC.
do $$
declare ok boolean := false; s text;
begin
  -- Setup: Bob & Alice are friends (re-established after earlier removal)
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
  perform public.request_friend('00000000-0000-0000-0000-00000000000a');
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
  s := public.request_friend('00000000-0000-0000-0000-00000000000b');
  if s <> 'accepted' then raise exception 'FAIL blocks-setup: friendship not accepted (%)', s; end if;

  -- Alice blocks Bob: friendship severed, Bob invisible to Alice
  perform public.block_user('00000000-0000-0000-0000-00000000000b');
  if exists (select 1 from public.friendships
             where requester_id in ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000b')
               and addressee_id in ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000b'))
    then raise exception 'FAIL blocks: friendship survived block'; end if;
  if exists (select 1 from public.nearby_profiles(48.8566, 2.3522, 5000) np
             where np.lat = 48.8566 and np.lng = 2.365866)
    then raise exception 'FAIL blocks: blocked user still in nearby'; end if;
  if exists (select 1 from public.search_members('Bob'))
    then raise exception 'FAIL blocks: blocked user still in search'; end if;

  -- Enforcement is bidirectional: Bob can't see or re-request Alice
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
  if exists (select 1 from public.nearby_profiles(48.8566, 2.3522, 5000) np
             where np.display_name = 'Alice')
    then raise exception 'FAIL blocks: blocker still visible to blocked user'; end if;
  begin
    perform public.request_friend('00000000-0000-0000-0000-00000000000a');
  exception when others then
    if sqlerrm like '%cannot send this request%' then ok := true; end if;
  end;
  if not ok then raise exception 'FAIL blocks: blocked user could send a request'; end if;

  -- Alice sees her block list and can unblock
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
  if (select count(*) from public.my_blocks()) <> 1
    then raise exception 'FAIL blocks: my_blocks wrong'; end if;
  perform public.unblock_user('00000000-0000-0000-0000-00000000000b');
  if exists (select 1 from public.my_blocks())
    then raise exception 'FAIL blocks: unblock did not clear'; end if;
  if not exists (select 1 from public.search_members('Bob'))
    then raise exception 'FAIL blocks: unblocked user still hidden from search'; end if;

  raise notice 'PASS: block severs friendship, hides both directions, unblock restores';
end $$;

-- The blocked person must not learn they were blocked (RLS, as the API role).
do $$
declare n int;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
  perform public.block_user('00000000-0000-0000-0000-00000000000b');
end $$;

set role authenticated;
do $$
declare n int;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
  select count(*) into n from public.blocks;
  if n <> 0 then raise exception 'FAIL blocks: blocked user can see % block rows', n; end if;
  raise notice 'PASS: blocked user cannot see who blocked them (RLS)';
end $$;
reset role;

do $$
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
  perform public.unblock_user('00000000-0000-0000-0000-00000000000b');
end $$;

-- ── constellation history + guardian mode (0011) ────────────────────────
do $$
declare h record; sid uuid; n int; ok boolean := false; s text;
begin
  -- History: Alice attended the sunset-run pin (auto-join at creation)
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
  select * into h from public.my_event_history() limit 1;
  if h is null then raise exception 'FAIL history: no rows for attendee'; end if;
  if h.lat is null or h.lng is null then raise exception 'FAIL history: coords missing'; end if;
  select count(*) into n from public.my_event_history() me where me.title = 'Sunset run — river loop';
  if n <> 1 then raise exception 'FAIL history: expected the sunset-run pin'; end if;

  -- Guardian: needs an accepted friendship (Bob<->Alice re-established in
  -- the blocks test flow: block severed it, so re-friend here)
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
  perform public.request_friend('00000000-0000-0000-0000-00000000000a');
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
  s := public.request_friend('00000000-0000-0000-0000-00000000000b');
  if s <> 'accepted' then raise exception 'FAIL guardian-setup: friendship % ', s; end if;

  -- Alice starts a session with Bob as guardian
  sid := public.start_guardian('00000000-0000-0000-0000-00000000000b', 120, 'Meetup at the river');
  if (select gs.status from public.my_guardian_sessions() gs where gs.id = sid) <> 'active'
    then raise exception 'FAIL guardian: session not active'; end if;
  if (select gs.role from public.my_guardian_sessions() gs where gs.id = sid) <> 'protege'
    then raise exception 'FAIL guardian: protege role wrong'; end if;

  -- Bob sees it from the guardian side
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
  if (select gs.role from public.my_guardian_sessions() gs where gs.id = sid) <> 'guardian'
    then raise exception 'FAIL guardian: guardian role wrong'; end if;
  if (select gs.other_name from public.my_guardian_sessions() gs where gs.id = sid) <> 'Alice'
    then raise exception 'FAIL guardian: counterpart name wrong'; end if;

  -- Only the protégé can change status; SOS then safe
  perform public.end_guardian(sid, false); -- Bob tries: silently 0 rows
  if (select status from public.guardian_sessions where id = sid) <> 'active'
    then raise exception 'FAIL guardian: guardian could change status'; end if;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
  perform public.end_guardian(sid, false);
  if (select status from public.guardian_sessions where id = sid) <> 'alarm'
    then raise exception 'FAIL guardian: SOS not recorded'; end if;
  perform public.end_guardian(sid, true);
  if (select status from public.guardian_sessions where id = sid) <> 'safe'
    then raise exception 'FAIL guardian: safe not recorded'; end if;

  -- Non-friend cannot be a guardian
  begin
    perform public.start_guardian('00000000-0000-0000-0000-00000000000c', 60);
  exception when others then
    if sqlerrm like '%accepted friend%' then ok := true; end if;
  end;
  if not ok then raise exception 'FAIL guardian: non-friend accepted as guardian'; end if;

  raise notice 'PASS: event history + guardian lifecycle (roles, SOS/safe, friend gate)';
end $$;

-- ── push tokens (0012) ──────────────────────────────────────────────────
do $$
begin
  -- Alice registers a device token; idempotent re-register keeps one row
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
  perform public.register_push_token('tok-1', 'ios');
  perform public.register_push_token('tok-1', 'ios');
  if (select count(*) from public.device_push_tokens where token = 'tok-1') <> 1
    then raise exception 'FAIL push: token not idempotent'; end if;
  if (select user_id from public.device_push_tokens where token = 'tok-1')
     <> '00000000-0000-0000-0000-00000000000a'
    then raise exception 'FAIL push: token owner wrong'; end if;

  -- Device changes hands: Bob signs in, same token reassigns to him
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
  perform public.register_push_token('tok-1', 'ios');
  if (select user_id from public.device_push_tokens where token = 'tok-1')
     <> '00000000-0000-0000-0000-00000000000b'
    then raise exception 'FAIL push: token did not reassign to new owner'; end if;

  -- Alice can no longer unregister Bob's token
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
  perform public.unregister_push_token('tok-1');
  if not exists (select 1 from public.device_push_tokens where token = 'tok-1')
    then raise exception 'FAIL push: wrong user unregistered a token'; end if;

  -- Bob unregisters his own
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
  perform public.unregister_push_token('tok-1');
  if exists (select 1 from public.device_push_tokens where token = 'tok-1')
    then raise exception 'FAIL push: unregister failed'; end if;
  raise notice 'PASS: push token register/reassign/unregister';
end $$;

-- Tokens are private (RLS, as the API role).
do $$ begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
  perform public.register_push_token('tok-secret', 'ios');
end $$;
set role authenticated;
do $$
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
  if exists (select 1 from public.device_push_tokens where token = 'tok-secret')
    then raise exception 'FAIL push: another user can read your device token'; end if;
  raise notice 'PASS: device tokens are private to their owner';
end $$;
reset role;
do $$ begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
  perform public.unregister_push_token('tok-secret');
end $$;

-- Account deletion: everything cascades.
do $$
declare n int;
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values ('00000000-0000-0000-0000-00000000000e', 'eve@example.com', '{"name":"Eve"}');
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', false);
  perform public.update_my_location(48.858, 2.351);
  perform public.create_event_pin('eve pin', 'yoga', 48.858, 2.352);
  perform public.request_friend('00000000-0000-0000-0000-00000000000a');

  perform public.delete_my_account();

  if exists (select 1 from auth.users where id = '00000000-0000-0000-0000-00000000000e')
    then raise exception 'FAIL delete: auth user survived'; end if;
  if exists (select 1 from public.profiles where id = '00000000-0000-0000-0000-00000000000e')
    then raise exception 'FAIL delete: profile survived'; end if;
  select count(*) into n from public.posts where title = 'eve pin';
  if n <> 0 then raise exception 'FAIL delete: posts survived'; end if;
  if exists (select 1 from public.friendships where requester_id = '00000000-0000-0000-0000-00000000000e')
    then raise exception 'FAIL delete: friendship survived'; end if;
  raise notice 'PASS: delete_my_account cascades auth user, profile, pins, friendships';
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
