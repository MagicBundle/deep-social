-- Deep Social — 0004_attendance_vibes.sql
-- Phase A: real attendance (attendees table, join/leave RPCs, live counts).
-- Phase B: photo "Vibe Checks" (media_attachments gated by attendance,
--          reports table, storage bucket + policies).
-- Apply after 0003.

set search_path = public, extensions;

-- ─── Phase A: attendance ─────────────────────────────────────────────────

create table public.attendees (
  post_id    uuid not null references public.posts (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index attendees_user_ix on public.attendees (user_id);

alter table public.posts add column attendee_count integer not null default 0;

-- Counter maintenance runs as definer: the acting user has no update
-- grant on posts (and isn't the pin owner), by design.
create or replace function public.bump_attendee_count()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set attendee_count = attendee_count + 1 where id = new.post_id;
    return new;
  else
    update public.posts set attendee_count = greatest(attendee_count - 1, 0) where id = old.post_id;
    return old;
  end if;
end;
$$;

create trigger attendees_count_trg
  after insert or delete on public.attendees
  for each row execute function public.bump_attendee_count();

alter table public.attendees enable row level security;
grant select, insert, delete on public.attendees to authenticated;

create policy "attendance readable by signed-in users"
  on public.attendees for select to authenticated using (true);

create policy "users join as themselves"
  on public.attendees for insert to authenticated with check (user_id = auth.uid());

create policy "users leave as themselves"
  on public.attendees for delete to authenticated using (user_id = auth.uid());

create function public.join_meetup(post_id uuid)
returns integer
language plpgsql security invoker set search_path = public, extensions
as $$
begin
  insert into public.attendees (post_id, user_id)
  values (join_meetup.post_id, auth.uid())
  on conflict do nothing;
  return (select attendee_count from public.posts p where p.id = join_meetup.post_id);
end;
$$;

create function public.leave_meetup(post_id uuid)
returns integer
language plpgsql security invoker set search_path = public, extensions
as $$
begin
  delete from public.attendees a
   where a.post_id = leave_meetup.post_id and a.user_id = auth.uid();
  return (select attendee_count from public.posts p where p.id = leave_meetup.post_id);
end;
$$;

-- Pin creators are attendees of their own event from the start.
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

-- ─── Phase B: vibe checks (photo media on pins) ──────────────────────────

create table public.media_attachments (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references public.posts (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null check (char_length(storage_path) <= 300),
  media_type   text not null default 'image' check (media_type = 'image'),
  created_at   timestamptz not null default now()
);

create index media_post_ix on public.media_attachments (post_id);

alter table public.media_attachments enable row level security;
grant select, insert, delete on public.media_attachments to authenticated;

create policy "vibes readable by signed-in users"
  on public.media_attachments for select to authenticated using (true);

-- The core gate: only current attendees of the pin can attach media.
create policy "attendees post vibes as themselves"
  on public.media_attachments for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.attendees a
      where a.post_id = media_attachments.post_id and a.user_id = auth.uid()
    )
  );

create policy "users delete own vibes"
  on public.media_attachments for delete to authenticated
  using (user_id = auth.uid());

create function public.add_vibe_media(post_id uuid, storage_path text)
returns uuid
language plpgsql security invoker set search_path = public, extensions
as $$
declare
  new_id uuid;
begin
  insert into public.media_attachments (post_id, user_id, storage_path)
  values (add_vibe_media.post_id, auth.uid(), add_vibe_media.storage_path)
  returning media_attachments.id into new_id;
  return new_id;
end;
$$;

-- Prototype moderation: incidents land in a table only the dashboard
-- (service role) can read. No select policy/grant for API roles by design.
create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  media_id    uuid not null references public.media_attachments (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason      text check (reason is null or char_length(reason) <= 300),
  created_at  timestamptz not null default now(),
  unique (media_id, reporter_id)
);

alter table public.reports enable row level security;
grant insert on public.reports to authenticated;

create policy "users report as themselves"
  on public.reports for insert to authenticated with check (reporter_id = auth.uid());

create function public.report_media(media_id uuid, reason text default null)
returns void
language plpgsql security invoker set search_path = public, extensions
as $$
begin
  insert into public.reports (media_id, reporter_id, reason)
  values (report_media.media_id, auth.uid(), report_media.reason)
  on conflict do nothing;
end;
$$;

-- ─── nearby_posts: counts + caller's joined state ────────────────────────

drop function public.nearby_posts(double precision, double precision, double precision);

create function public.nearby_posts(
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
  venue text,
  attendee_count integer,
  joined boolean,
  media_count integer,
  lat double precision,
  lng double precision,
  distance_m double precision,
  created_at timestamptz
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
  order by po.created_at desc
  limit 200;
$$;

-- ─── function execution grants ───────────────────────────────────────────

revoke execute on function public.join_meetup(uuid) from public, anon;
revoke execute on function public.leave_meetup(uuid) from public, anon;
revoke execute on function public.add_vibe_media(uuid, text) from public, anon;
revoke execute on function public.report_media(uuid, text) from public, anon;
revoke execute on function public.nearby_posts(double precision, double precision, double precision) from public, anon;
grant execute on function public.join_meetup(uuid) to authenticated;
grant execute on function public.leave_meetup(uuid) to authenticated;
grant execute on function public.add_vibe_media(uuid, text) to authenticated;
grant execute on function public.report_media(uuid, text) to authenticated;
grant execute on function public.nearby_posts(double precision, double precision, double precision) to authenticated;

-- ─── realtime ────────────────────────────────────────────────────────────

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.media_attachments;
  end if;
end $$;

-- ─── storage: the 'vibes' bucket (Supabase only; skipped on vanilla PG) ──
-- 2 MB hard cap, images only, public read (pins are public content).
-- Upload path convention: <post_id>/<random>.jpg — the insert policy checks
-- attendance against the first path segment, mirroring the table RLS.

do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('vibes', 'vibes', true, 2097152, array['image/jpeg', 'image/webp'])
    on conflict (id) do nothing;

    begin
      execute $pol$
        create policy "attendees upload vibes"
          on storage.objects for insert to authenticated
          with check (
            bucket_id = 'vibes'
            and exists (
              select 1 from public.attendees a
              where a.user_id = auth.uid()
                and a.post_id::text = (storage.foldername(name))[1]
            )
          )
      $pol$;
      execute $pol$
        create policy "owners delete vibe files"
          on storage.objects for delete to authenticated
          using (bucket_id = 'vibes' and owner_id = auth.uid()::text)
      $pol$;
    exception
      when insufficient_privilege then
        raise notice 'Could not create storage policies via SQL — add them in Dashboard > Storage > vibes > Policies (insert: attendees of the post; delete: owner).';
      when duplicate_object then
        null;
    end;
  end if;
end $$;
