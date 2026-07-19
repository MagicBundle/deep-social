-- Deep Social — 0019_constellation_archive.sql
-- Fix: the retention sweep destroyed Constellation history.
--
-- my_event_history() (which powers Constellation and the monthly recap) read
-- straight from `attendees JOIN posts`. The 0017 retention sweep deletes
-- event pins 30 days after they end, and attendees cascades on that delete —
-- so a user's memory silently lost every event older than 30 days, gutting
-- the "sky that fills as months accumulate".
--
-- Fix: distinguish transient presence from historical connection. When the
-- sweep prunes a pin, snapshot each attendee's record into a durable archive
-- first; my_event_history() then reads live attendance UNION the archive.
-- Apply after 0018.

set search_path = public, extensions;

-- ── durable personal event memory ───────────────────────────────────────
create table public.attended_archive (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  post_id      uuid not null,
  title        text,
  category     text,
  venue        text,
  author_name  text,
  starts_at    timestamptz,
  duration_min integer,
  lat          double precision,
  lng          double precision,
  joined_at    timestamptz,
  archived_at  timestamptz not null default now(),
  primary key (user_id, post_id)
);

alter table public.attended_archive enable row level security;

-- Own rows only. No write grants to app roles: only the retention function
-- (definer) writes here; account deletion cascades these rows away.
create policy "read own archived events"
  on public.attended_archive for select to authenticated
  using (user_id = auth.uid());
grant select on public.attended_archive to authenticated;

-- ── retention sweep: archive attendees before pruning a pin ──────────────
create or replace function public.run_data_retention()
returns table (deleted_storage_path text)
language plpgsql security definer set search_path = public, extensions
as $$
declare
  stale_ids uuid[];
begin
  update public.profiles
     set current_vibe = null, vibe_set_at = null
   where vibe_set_at is not null and vibe_set_at < now() - interval '3 hours';

  update public.profiles
     set last_location = null, location_updated_at = null
   where location_updated_at is not null and location_updated_at < now() - interval '24 hours';

  delete from public.device_push_tokens where updated_at < now() - interval '60 days';

  delete from public.guardian_sessions
   where status <> 'active' and ends_at < now() - interval '30 days';

  select array_agg(po.id) into stale_ids
    from public.posts po
   where po.starts_at + make_interval(mins => po.duration_min) < now() - interval '30 days'
     and not exists (
       select 1 from public.reports r
        where r.status = 'open'
          and ( (r.target_kind = 'pin' and r.target_id = po.id)
             or (r.target_kind = 'media' and r.target_id in (
                   select m.id from public.media_attachments m where m.post_id = po.id)) )
     );

  if stale_ids is not null then
    -- preserve each attendee's private memory of the pin before it is pruned
    insert into public.attended_archive
      (user_id, post_id, title, category, venue, author_name, starts_at, duration_min, lat, lng, joined_at)
    select a.user_id, po.id, po.title, po.category, po.venue, pr.display_name,
           po.starts_at, po.duration_min,
           st_y(po.location::geometry), st_x(po.location::geometry), a.created_at
      from public.attendees a
      join public.posts po on po.id = a.post_id
      join public.profiles pr on pr.id = po.user_id
     where a.post_id = any(stale_ids)
    on conflict (user_id, post_id) do nothing;

    return query
      select m.storage_path from public.media_attachments m where m.post_id = any(stale_ids);

    delete from public.posts where id = any(stale_ids);
  end if;
end;
$$;

revoke execute on function public.run_data_retention() from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.run_data_retention() to service_role;
  end if;
end $$;

-- ── my_event_history: live attendance UNION durable archive ──────────────
create or replace function public.my_event_history()
returns table (
  id uuid, title text, category text, venue text, author_name text,
  starts_at timestamptz, duration_min integer,
  lat double precision, lng double precision, joined_at timestamptz
)
language sql security invoker stable set search_path = public, extensions
as $$
  select po.id, po.title, po.category, po.venue, pr.display_name,
         po.starts_at, po.duration_min,
         st_y(po.location::geometry) as lat, st_x(po.location::geometry) as lng,
         a.created_at as joined_at
    from public.attendees a
    join public.posts po on po.id = a.post_id
    join public.profiles pr on pr.id = po.user_id
   where a.user_id = auth.uid()
  union all
  select ar.post_id, ar.title, ar.category, ar.venue, ar.author_name,
         ar.starts_at, ar.duration_min, ar.lat, ar.lng, ar.joined_at
    from public.attended_archive ar
   where ar.user_id = auth.uid()
     and not exists (select 1 from public.posts p where p.id = ar.post_id)
  order by starts_at desc
  limit 500;
$$;
