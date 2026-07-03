-- Deep Social — 0002_event_pins.sql
-- Posts become structured EVENT PINS: what, which interest, when, how long.
-- Apply after 0001 (Supabase SQL editor or `supabase db push`).

set search_path = public, extensions;

alter table public.posts
  add column title        text not null default 'Community pin'
             check (char_length(title) between 1 and 80),
  add column category     text not null default 'music'
             check (char_length(category) between 1 and 32),
  add column starts_at    timestamptz not null default now(),
  add column duration_min integer not null default 120
             check (duration_min between 15 and 720);

-- content becomes an optional description
alter table public.posts alter column content drop not null;
alter table public.posts drop constraint posts_content_check;
alter table public.posts add constraint posts_content_check
  check (content is null or char_length(content) between 1 and 500);

-- Replaced by create_event_pin / the richer nearby_posts below.
drop function public.create_post(text, double precision, double precision);
drop function public.nearby_posts(double precision, double precision, double precision, interval);

create or replace function public.create_event_pin(
  title        text,
  category     text,
  lat          double precision,
  lng          double precision,
  starts_at    timestamptz default now(),
  duration_min integer default 120,
  description  text default null
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
  insert into public.posts (user_id, title, category, starts_at, duration_min, content, location)
  values (
    auth.uid(),
    create_event_pin.title,
    create_event_pin.category,
    create_event_pin.starts_at,
    create_event_pin.duration_min,
    create_event_pin.description,
    st_setsrid(st_makepoint(lng, lat), 4326)::geography
  )
  returning posts.id into new_id;
  return new_id;
end;
$$;

-- Pins near a point: upcoming (next 48 h) or still ongoing, newest first.
create or replace function public.nearby_posts(
  origin_lat double precision,
  origin_lng double precision,
  radius_m   double precision default 5000
)
returns table (
  id uuid,
  user_id uuid,
  author_name text,
  author_avatar_url text,
  title text,
  category text,
  starts_at timestamptz,
  duration_min integer,
  description text,
  lat double precision,
  lng double precision,
  distance_m double precision,
  created_at timestamptz
)
language sql security invoker set search_path = public, extensions
stable
as $$
  select po.id, po.user_id, pr.display_name, pr.avatar_url,
         po.title, po.category, po.starts_at, po.duration_min, po.content,
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
  order by po.created_at desc
  limit 200;
$$;

revoke execute on function public.create_event_pin(text, text, double precision, double precision, timestamptz, integer, text) from public, anon;
revoke execute on function public.nearby_posts(double precision, double precision, double precision) from public, anon;
grant execute on function public.create_event_pin(text, text, double precision, double precision, timestamptz, integer, text) to authenticated;
grant execute on function public.nearby_posts(double precision, double precision, double precision) to authenticated;
