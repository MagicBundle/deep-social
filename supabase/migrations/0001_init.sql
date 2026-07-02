-- Deep Social data backbone — 0001_init.sql
-- Apply via the Supabase SQL editor (paste whole file) or `supabase db push`.
--
-- Design invariants:
--   1. Raw coordinates are NEVER selectable by API roles. `last_location` and
--      `email` are excluded from column grants; coordinates only flow through
--      RPCs that enforce the per-user privacy tier (precise / fuzzed / off).
--   2. All writes to coordinates go through update_my_location() — there is
--      no way to write another user's location.
--   3. RLS is enabled on everything; policies are additive on top of the
--      column grants.

set search_path = public, extensions;

create schema if not exists extensions;
create extension if not exists postgis with schema extensions;

-- Supabase grants this by default; stated explicitly so the schema also
-- works on vanilla Postgres and survives hardened projects. API roles need
-- it because security-invoker functions (create_post, nearby_posts) resolve
-- PostGIS names as the calling role.
grant usage on schema extensions to anon, authenticated;

-- ─── profiles ────────────────────────────────────────────────────────────

create table public.profiles (
  id                  uuid primary key references auth.users (id) on delete cascade,
  email               text,
  display_name        text not null default 'New member',
  avatar_url          text,
  interests           text[] not null default '{}',
  -- Live-location privacy tier. Off by default: sharing is strictly opt-in.
  location_sharing    text not null default 'off'
                      check (location_sharing in ('precise', 'fuzzed', 'off')),
  last_location       extensions.geography(point, 4326),
  location_updated_at timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on column public.profiles.location_sharing is
  'precise = exact coords in nearby results; fuzzed = ~500m grid snap; off = never listed';

create index profiles_last_location_gix on public.profiles using gist (last_location);

-- Server-side half of the auth-to-DB bridge: every new auth user gets a
-- profile row, populated from the OAuth metadata Supabase stores.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public, extensions
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(coalesce(new.email, 'member@'), '@', 1)
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ─── posts (map pins) ────────────────────────────────────────────────────

create table public.posts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  content    text not null check (char_length(content) between 1 and 500),
  location   extensions.geography(point, 4326) not null,
  created_at timestamptz not null default now()
);

create index posts_location_gix on public.posts using gist (location);
create index posts_created_at_ix on public.posts (created_at desc);

-- ─── row level security + column grants ─────────────────────────────────

alter table public.profiles enable row level security;
alter table public.posts enable row level security;

-- Column-level privileges: API roles can read profile identity but never
-- email or raw coordinates. Coordinates reach clients only through the
-- privacy-tier-aware RPCs below.
revoke all on table public.profiles from anon, authenticated;
grant select (id, display_name, avatar_url, interests, location_sharing, created_at)
  on public.profiles to authenticated;
grant insert (id, email, display_name, avatar_url, interests)
  on public.profiles to authenticated;
grant update (email, display_name, avatar_url, interests, location_sharing)
  on public.profiles to authenticated;

revoke all on table public.posts from anon, authenticated;
grant select, insert, delete on public.posts to authenticated;
grant update (content) on public.posts to authenticated;

create policy "profiles readable by signed-in users"
  on public.profiles for select to authenticated
  using (true);

create policy "users insert own profile"
  on public.profiles for insert to authenticated
  with check (id = auth.uid());

create policy "users update own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "posts readable by signed-in users"
  on public.posts for select to authenticated
  using (true);

create policy "users create own posts"
  on public.posts for insert to authenticated
  with check (user_id = auth.uid());

create policy "users edit own posts"
  on public.posts for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "users delete own posts"
  on public.posts for delete to authenticated
  using (user_id = auth.uid());

-- ─── geospatial RPCs ─────────────────────────────────────────────────────

-- The only write path for coordinates.
create or replace function public.update_my_location(lat double precision, lng double precision)
returns void
language plpgsql security definer set search_path = public, extensions
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if lat not between -90 and 90 or lng not between -180 and 180 then
    raise exception 'invalid coordinates';
  end if;
  update public.profiles
     set last_location = st_setsrid(st_makepoint(lng, lat), 4326)::geography,
         location_updated_at = now()
   where id = auth.uid();
end;
$$;

-- "Show me everyone within N meters of these coordinates."
-- security definer because it must read last_location (not API-selectable);
-- it re-implements visibility rules: sharing tier, 2h freshness, self excluded.
create or replace function public.nearby_profiles(
  origin_lat double precision,
  origin_lng double precision,
  radius_m   double precision default 5000
)
returns table (
  id uuid,
  display_name text,
  avatar_url text,
  interests text[],
  lat double precision,
  lng double precision,
  distance_m double precision,
  location_updated_at timestamptz
)
language sql security definer set search_path = public, extensions
stable
as $$
  with origin as (
    select st_setsrid(st_makepoint(origin_lng, origin_lat), 4326)::geography as g
  ),
  visible as (
    select p.id, p.display_name, p.avatar_url, p.interests, p.location_updated_at,
           case p.location_sharing
             when 'precise' then p.last_location
             -- Deterministic ~500 m grid snap: repeated queries return the
             -- same fuzzed point, so jitter can't be averaged away.
             else st_snaptogrid(p.last_location::geometry, 0.005)::geography
           end as shown_location
    from public.profiles p, origin o
    where p.location_sharing <> 'off'
      and p.last_location is not null
      and p.location_updated_at > now() - interval '2 hours'
      and p.id is distinct from auth.uid()
      -- index-assisted prefilter on the real column (fuzz moves points <800m)
      and st_dwithin(p.last_location, o.g, radius_m + 800)
  )
  select v.id, v.display_name, v.avatar_url, v.interests,
         st_y(v.shown_location::geometry) as lat,
         st_x(v.shown_location::geometry) as lng,
         st_distance(v.shown_location, o.g) as distance_m,
         v.location_updated_at
  from visible v, origin o
  where st_dwithin(v.shown_location, o.g, radius_m)
  order by st_distance(v.shown_location, o.g)
  limit 200;
$$;

-- Pins near a point, newest first. security invoker: RLS applies as usual.
create or replace function public.nearby_posts(
  origin_lat double precision,
  origin_lng double precision,
  radius_m   double precision default 5000,
  max_age    interval default interval '24 hours'
)
returns table (
  id uuid,
  user_id uuid,
  author_name text,
  author_avatar_url text,
  content text,
  lat double precision,
  lng double precision,
  distance_m double precision,
  created_at timestamptz
)
language sql security invoker set search_path = public, extensions
stable
as $$
  select po.id, po.user_id, pr.display_name, pr.avatar_url, po.content,
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
    and po.created_at > now() - max_age
  order by po.created_at desc
  limit 200;
$$;

-- Insert path for pins (constructs the geography server-side).
-- security invoker: the RLS insert policy still enforces user_id = auth.uid().
create or replace function public.create_post(
  content text,
  lat double precision,
  lng double precision
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
  insert into public.posts (user_id, content, location)
  values (
    auth.uid(),
    create_post.content,
    st_setsrid(st_makepoint(lng, lat), 4326)::geography
  )
  returning posts.id into new_id;
  return new_id;
end;
$$;

-- Own profile incl. private columns (email, exact coords).
create or replace function public.get_my_profile()
returns table (
  id uuid,
  email text,
  display_name text,
  avatar_url text,
  interests text[],
  location_sharing text,
  lat double precision,
  lng double precision,
  location_updated_at timestamptz
)
language sql security definer set search_path = public, extensions
stable
as $$
  select p.id, p.email, p.display_name, p.avatar_url, p.interests, p.location_sharing,
         st_y(p.last_location::geometry) as lat,
         st_x(p.last_location::geometry) as lng,
         p.location_updated_at
  from public.profiles p
  where p.id = auth.uid();
$$;

-- Lock function execution to signed-in users only.
revoke execute on function public.update_my_location(double precision, double precision) from public, anon;
revoke execute on function public.nearby_profiles(double precision, double precision, double precision) from public, anon;
revoke execute on function public.nearby_posts(double precision, double precision, double precision, interval) from public, anon;
revoke execute on function public.create_post(text, double precision, double precision) from public, anon;
revoke execute on function public.get_my_profile() from public, anon;
grant execute on function public.update_my_location(double precision, double precision) to authenticated;
grant execute on function public.nearby_profiles(double precision, double precision, double precision) to authenticated;
grant execute on function public.nearby_posts(double precision, double precision, double precision, interval) to authenticated;
grant execute on function public.create_post(text, double precision, double precision) to authenticated;
grant execute on function public.get_my_profile() to authenticated;

-- ─── realtime ────────────────────────────────────────────────────────────
-- posts INSERTs are broadcast (RLS-filtered) so maps update without refresh.
-- profiles is deliberately NOT in the publication: change events would carry
-- the raw last_location column, bypassing the privacy tiers. Live member
-- positions belong to Realtime Presence (ephemeral, opt-in) instead.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.posts;
  end if;
end $$;
