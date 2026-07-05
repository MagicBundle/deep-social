-- Deep Social — 0006_limits_avatars.sql
-- 1) Rate limit: max 3 event pins per user per rolling 24 h (server-side).
-- 2) Custom emoji avatars for real users (profiles.avatar_emoji).
-- Apply after 0005.

set search_path = public, extensions;

-- ─── avatar_emoji ────────────────────────────────────────────────────────

alter table public.profiles
  add column avatar_emoji text
  check (avatar_emoji is null or char_length(avatar_emoji) <= 8);

-- Column grants are additive; expose the new column to the API role.
grant select (avatar_emoji) on public.profiles to authenticated;
grant update (avatar_emoji) on public.profiles to authenticated;

-- my_friendships gains the friend's emoji (return type change: drop+create)
drop function public.my_friendships();

create function public.my_friendships()
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  avatar_emoji text,
  interests text[],
  state text,
  since timestamptz
)
language sql security invoker stable set search_path = public, extensions
as $$
  select p.id, p.display_name, p.avatar_url, p.avatar_emoji, p.interests,
         case
           when f.status = 'accepted' then 'friend'
           when f.addressee_id = auth.uid() then 'incoming'
           else 'outgoing'
         end as state,
         f.created_at
  from public.friendships f
  join public.profiles p
    on p.id = case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
  where f.requester_id = auth.uid() or f.addressee_id = auth.uid()
  order by f.created_at desc;
$$;

revoke execute on function public.my_friendships() from public, anon;
grant execute on function public.my_friendships() to authenticated;

-- ─── pin rate limit ──────────────────────────────────────────────────────
-- Same signature as 0004's version, so create or replace is safe.

create or replace function public.create_event_pin(
  title        text,
  category     text,
  lat          double precision,
  lng          double precision,
  starts_at    timestamptz default now(),
  duration_min integer default 120,
  description  text default null,
  venue        text default null
)
returns uuid
language plpgsql security invoker set search_path = public, extensions
as $$
declare
  new_id uuid;
begin
  if lat not between -90 and 90 or lng not between -180 and 180 then
    raise exception 'invalid coordinates';
  end if;
  if (select count(*) from public.posts p
       where p.user_id = auth.uid()
         and p.created_at > now() - interval '24 hours') >= 3 then
    raise exception 'daily pin limit reached';
  end if;
  insert into public.posts (user_id, title, category, starts_at, duration_min, content, venue, location)
  values (
    auth.uid(),
    create_event_pin.title,
    create_event_pin.category,
    create_event_pin.starts_at,
    create_event_pin.duration_min,
    create_event_pin.description,
    create_event_pin.venue,
    st_setsrid(st_makepoint(lng, lat), 4326)::geography
  )
  returning posts.id into new_id;
  insert into public.attendees (post_id, user_id) values (new_id, auth.uid());
  return new_id;
end;
$$;
