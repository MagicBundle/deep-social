-- Deep Social — 0010_compliance.sql
-- App Store review requirements: user blocking (guideline 1.2) and in-app
-- account deletion (guideline 5.1.1). Apply after 0009.

set search_path = public, extensions;

-- ─── blocks ──────────────────────────────────────────────────────────────
-- One-directional rows; enforcement is bidirectional (neither side sees or
-- can contact the other). The blocked person must never learn they were
-- blocked: RLS lets only the BLOCKER read their own rows.

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index blocks_blocked_ix on public.blocks (blocked_id);

alter table public.blocks enable row level security;
grant select, insert, delete on public.blocks to authenticated;

create policy "blockers read own blocks"
  on public.blocks for select to authenticated using (blocker_id = auth.uid());
create policy "users block as themselves"
  on public.blocks for insert to authenticated with check (blocker_id = auth.uid());
create policy "users unblock as themselves"
  on public.blocks for delete to authenticated using (blocker_id = auth.uid());

-- Definer so enforcement can check both directions without exposing rows.
create function public.is_blocked(a uuid, b uuid)
returns boolean
language sql stable security definer set search_path = public, extensions
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b)
       or (blocker_id = b and blocked_id = a)
  );
$$;

-- Blocking also severs any friendship/pending request, both directions.
create function public.block_user(target uuid)
returns void
language plpgsql security invoker set search_path = public, extensions
as $$
begin
  if target = auth.uid() then raise exception 'cannot block yourself'; end if;
  insert into public.blocks (blocker_id, blocked_id)
  values (auth.uid(), target)
  on conflict do nothing;
  delete from public.friendships f
   where (f.requester_id = auth.uid() and f.addressee_id = target)
      or (f.requester_id = target and f.addressee_id = auth.uid());
end;
$$;

create function public.unblock_user(target uuid)
returns void
language sql security invoker set search_path = public, extensions
as $$
  delete from public.blocks
   where blocker_id = auth.uid() and blocked_id = target;
$$;

create function public.my_blocks()
returns table (user_id uuid, display_name text, avatar_url text, avatar_emoji text, since timestamptz)
language sql security invoker stable set search_path = public, extensions
as $$
  select p.id, p.display_name, p.avatar_url, p.avatar_emoji, b.created_at
  from public.blocks b
  join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc;
$$;

-- ─── enforcement across existing surfaces (same signatures: or-replace) ──

-- Discovery: blocked either way -> invisible.
create or replace function public.nearby_profiles(
  origin_lat double precision,
  origin_lng double precision,
  radius_m   double precision default 5000
)
returns table (
  id uuid, display_name text, avatar_url text, avatar_emoji text,
  interests text[], vibe text, identified boolean, is_friend boolean,
  lat double precision, lng double precision, distance_m double precision,
  location_updated_at timestamptz
)
language sql security definer set search_path = public, extensions
stable
as $$
  with origin as (
    select st_setsrid(st_makepoint(origin_lng, origin_lat), 4326)::geography as g
  ),
  cand as (
    select p.id, p.display_name, p.avatar_url, p.avatar_emoji, p.interests,
           case when p.vibe_set_at > now() - interval '3 hours'
                then p.current_vibe end as vibe,
           p.visibility_mode, p.last_location, p.location_updated_at,
           public.are_friends(auth.uid(), p.id) as is_friend
    from public.profiles p, origin o
    where p.last_location is not null
      and p.location_updated_at > now() - interval '2 hours'
      and p.id is distinct from auth.uid()
      and not public.is_blocked(auth.uid(), p.id)
      and st_dwithin(p.last_location, o.g, radius_m + 800)
  ),
  visible as (
    select c.*,
           (c.is_friend or c.visibility_mode = 'beacon') as identified,
           case when c.is_friend or c.visibility_mode <> 'observer'
                then c.last_location
                else st_snaptogrid(c.last_location::geometry, 0.005)::geography
           end as shown_location
    from cand c
    where c.is_friend or c.visibility_mode in ('beacon', 'observer')
  )
  select v.id,
         case when v.identified then v.display_name end,
         case when v.identified then v.avatar_url end,
         case when v.identified then v.avatar_emoji end,
         v.interests, v.vibe, v.identified, v.is_friend,
         st_y(v.shown_location::geometry) as lat,
         st_x(v.shown_location::geometry) as lng,
         st_distance(v.shown_location, o.g) as distance_m,
         v.location_updated_at
  from visible v, origin o
  where st_dwithin(v.shown_location, o.g, radius_m)
  order by st_distance(v.shown_location, o.g)
  limit 200;
$$;

-- Pins: hide blocked authors' events.
create or replace function public.nearby_posts(
  origin_lat double precision,
  origin_lng double precision,
  radius_m   double precision default 5000
)
returns table (
  id uuid, user_id uuid, author_name text, author_avatar_url text,
  title text, category text, starts_at timestamptz, duration_min integer,
  description text, venue text, attendee_count integer, joined boolean,
  media_count integer, lat double precision, lng double precision,
  distance_m double precision, created_at timestamptz
)
language sql security invoker set search_path = public, extensions
stable
as $$
  select po.id, po.user_id, pr.display_name, pr.avatar_url,
         po.title, po.category, po.starts_at, po.duration_min, po.content, po.venue,
         po.attendee_count,
         exists (
           select 1 from public.attendees a
           where a.post_id = po.id and a.user_id = auth.uid()
         ) as joined,
         (select count(*)::int from public.media_attachments m where m.post_id = po.id) as media_count,
         st_y(po.location::geometry) as lat,
         st_x(po.location::geometry) as lng,
         st_distance(po.location,
           st_setsrid(st_makepoint(origin_lng, origin_lat), 4326)::geography) as distance_m,
         po.created_at
  from public.posts po
  join public.profiles pr on pr.id = po.user_id
  where st_dwithin(po.location,
          st_setsrid(st_makepoint(origin_lng, origin_lat), 4326)::geography,
          radius_m)
    and po.starts_at + make_interval(mins => po.duration_min) > now()
    and po.starts_at < now() + interval '48 hours'
    and not public.is_blocked(auth.uid(), po.user_id)
  order by po.created_at desc
  limit 200;
$$;

-- Requests: blocked pairs cannot re-connect.
create or replace function public.request_friend(target uuid)
returns text
language plpgsql security invoker set search_path = public, extensions
as $$
declare
  cur text;
begin
  if target = auth.uid() then
    raise exception 'cannot befriend yourself';
  end if;
  if public.is_blocked(auth.uid(), target) then
    raise exception 'cannot send this request';
  end if;
  select f.status into cur from public.friendships f
   where (f.requester_id = auth.uid() and f.addressee_id = target)
      or (f.requester_id = target and f.addressee_id = auth.uid());
  if cur = 'accepted' then
    return 'accepted';
  end if;
  if cur = 'pending' then
    update public.friendships
       set status = 'accepted', responded_at = now()
     where requester_id = target and addressee_id = auth.uid() and status = 'pending';
    if found then return 'accepted'; end if;
    return 'pending';
  end if;
  insert into public.friendships (requester_id, addressee_id)
  values (auth.uid(), target);
  return 'pending';
end;
$$;

-- DMs: blocking severs the friendship, which already gates send_dm; add the
-- explicit check anyway, and hide old threads/unreads from both sides.
create or replace function public.send_dm(recipient uuid, body text)
returns uuid
language plpgsql security invoker set search_path = public, extensions
as $$
declare
  new_id uuid;
begin
  if public.is_blocked(auth.uid(), recipient) then
    raise exception 'cannot message this user';
  end if;
  if not public.are_friends(auth.uid(), recipient) then
    raise exception 'can only message accepted friends';
  end if;
  insert into public.direct_messages (sender_id, recipient_id, body)
  values (auth.uid(), recipient, send_dm.body)
  returning direct_messages.id into new_id;
  return new_id;
end;
$$;

create or replace function public.conversation(friend uuid)
returns table (id uuid, sender_id uuid, body text, created_at timestamptz, mine boolean)
language sql security invoker stable set search_path = public, extensions
as $$
  select d.id, d.sender_id, d.body, d.created_at, d.sender_id = auth.uid()
  from public.direct_messages d
  where ((d.sender_id = auth.uid() and d.recipient_id = friend)
      or (d.sender_id = friend and d.recipient_id = auth.uid()))
    and not public.is_blocked(auth.uid(), friend)
  order by d.created_at asc
  limit 500;
$$;

create or replace function public.dm_unread_counts()
returns table (friend_id uuid, unread integer)
language sql security invoker stable set search_path = public, extensions
as $$
  select sender_id, count(*)::int
  from public.direct_messages
  where recipient_id = auth.uid() and read_at is null
    and not public.is_blocked(auth.uid(), sender_id)
  group by sender_id;
$$;

-- Member search moves server-side so blocks apply (was a client-side select).
create function public.search_members(q text)
returns table (id uuid, display_name text, avatar_url text, avatar_emoji text, interests text[])
language sql security invoker stable set search_path = public, extensions
as $$
  select p.id, p.display_name, p.avatar_url, p.avatar_emoji, p.interests
  from public.profiles p
  where p.id is distinct from auth.uid()
    and not public.is_blocked(auth.uid(), p.id)
    and p.display_name ilike '%' || q || '%'
  order by p.display_name
  limit 8;
$$;

-- ─── in-app account deletion (App Store 5.1.1) ───────────────────────────
-- Deleting the auth user cascades through profiles → posts, attendance,
-- friendships, DMs, media rows, blocks, reports. (Storage files of deleted
-- vibes are cleaned up manually during beta.)
create function public.delete_my_account()
returns void
language plpgsql security definer set search_path = public, extensions
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = uid;
end;
$$;

-- ─── grants ──────────────────────────────────────────────────────────────

revoke execute on function public.is_blocked(uuid, uuid) from public, anon;
revoke execute on function public.block_user(uuid) from public, anon;
revoke execute on function public.unblock_user(uuid) from public, anon;
revoke execute on function public.my_blocks() from public, anon;
revoke execute on function public.search_members(text) from public, anon;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.is_blocked(uuid, uuid) to authenticated;
grant execute on function public.block_user(uuid) to authenticated;
grant execute on function public.unblock_user(uuid) to authenticated;
grant execute on function public.my_blocks() to authenticated;
grant execute on function public.search_members(text) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
