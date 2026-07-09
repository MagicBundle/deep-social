-- Deep Social — 0009_vibes.sql
-- Hot Layer increment 1: "tonight's vibe" — a transient tag (TTL 3 h) that
-- travels with your presence. Unlike interests (durable), a vibe says what
-- you're up for right now; it shows on beacon profiles AND anonymous
-- observer dots (transient, so low identity risk — and it's the clustering
-- signal for the future simulation engine).
-- Apply after 0008.

set search_path = public, extensions;

alter table public.profiles
  add column current_vibe text
    check (current_vibe is null or char_length(current_vibe) <= 32),
  add column vibe_set_at timestamptz;

grant select (current_vibe, vibe_set_at) on public.profiles to authenticated;
grant update (current_vibe, vibe_set_at) on public.profiles to authenticated;

-- Both discovery functions gain the (unexpired) vibe: drop + recreate.
drop function public.nearby_profiles(double precision, double precision, double precision);
drop function public.get_my_profile();

create function public.nearby_profiles(
  origin_lat double precision,
  origin_lng double precision,
  radius_m   double precision default 5000
)
returns table (
  id uuid,
  display_name text,
  avatar_url text,
  avatar_emoji text,
  interests text[],
  vibe text,
  identified boolean,
  is_friend boolean,
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
         v.interests,
         v.vibe,  -- transient by design: shown for observers too
         v.identified,
         v.is_friend,
         st_y(v.shown_location::geometry) as lat,
         st_x(v.shown_location::geometry) as lng,
         st_distance(v.shown_location, o.g) as distance_m,
         v.location_updated_at
  from visible v, origin o
  where st_dwithin(v.shown_location, o.g, radius_m)
  order by st_distance(v.shown_location, o.g)
  limit 200;
$$;

create function public.get_my_profile()
returns table (
  id uuid,
  email text,
  display_name text,
  avatar_url text,
  avatar_emoji text,
  interests text[],
  visibility_mode text,
  current_vibe text,
  lat double precision,
  lng double precision,
  location_updated_at timestamptz
)
language sql security definer set search_path = public, extensions
stable
as $$
  select p.id, p.email, p.display_name, p.avatar_url, p.avatar_emoji, p.interests,
         p.visibility_mode,
         case when p.vibe_set_at > now() - interval '3 hours'
              then p.current_vibe end as current_vibe,
         st_y(p.last_location::geometry) as lat,
         st_x(p.last_location::geometry) as lng,
         p.location_updated_at
  from public.profiles p
  where p.id = auth.uid();
$$;

revoke execute on function public.nearby_profiles(double precision, double precision, double precision) from public, anon;
revoke execute on function public.get_my_profile() from public, anon;
grant execute on function public.nearby_profiles(double precision, double precision, double precision) to authenticated;
grant execute on function public.get_my_profile() to authenticated;
