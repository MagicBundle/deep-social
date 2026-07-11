-- Deep Social — 0011_constellation_guardian.sql
-- Constellation: your event history (attendance is already stored; this
-- exposes YOUR OWN rows with coordinates, past events included).
-- Guardian mode: a friend watches over you for the duration of a meetup.
-- Apply after 0010.

set search_path = public, extensions;

-- ─── constellation: my event history ─────────────────────────────────────

create function public.my_event_history()
returns table (
  id uuid,
  title text,
  category text,
  venue text,
  author_name text,
  starts_at timestamptz,
  duration_min integer,
  lat double precision,
  lng double precision,
  joined_at timestamptz
)
language sql security invoker stable set search_path = public, extensions
as $$
  select po.id, po.title, po.category, po.venue, pr.display_name,
         po.starts_at, po.duration_min,
         st_y(po.location::geometry) as lat,
         st_x(po.location::geometry) as lng,
         a.created_at as joined_at
  from public.attendees a
  join public.posts po on po.id = a.post_id
  join public.profiles pr on pr.id = po.user_id
  where a.user_id = auth.uid()
  order by po.starts_at desc
  limit 500;
$$;

-- ─── guardian mode ───────────────────────────────────────────────────────
-- The protégé starts a session naming an accepted friend; only the protégé
-- can change its status. Both parties can read it (the guardian's client
-- warns if the window expires while still 'active').

create table public.guardian_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  guardian_id uuid not null references public.profiles (id) on delete cascade,
  note        text check (note is null or char_length(note) <= 200),
  status      text not null default 'active' check (status in ('active', 'safe', 'alarm')),
  started_at  timestamptz not null default now(),
  ends_at     timestamptz not null,
  check (user_id <> guardian_id)
);

create index guardian_sessions_guardian_ix on public.guardian_sessions (guardian_id, ends_at);

alter table public.guardian_sessions enable row level security;
grant select, insert on public.guardian_sessions to authenticated;
grant update (status) on public.guardian_sessions to authenticated;

create policy "participants read guardian sessions"
  on public.guardian_sessions for select to authenticated
  using (user_id = auth.uid() or guardian_id = auth.uid());

create policy "users start their own sessions"
  on public.guardian_sessions for insert to authenticated
  with check (user_id = auth.uid());

create policy "only the protege updates status"
  on public.guardian_sessions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create function public.start_guardian(guardian uuid, minutes integer, note text default null)
returns uuid
language plpgsql security invoker set search_path = public, extensions
as $$
declare
  new_id uuid;
begin
  if not public.are_friends(auth.uid(), guardian) then
    raise exception 'guardian must be an accepted friend';
  end if;
  if minutes not between 15 and 480 then
    raise exception 'duration must be between 15 minutes and 8 hours';
  end if;
  insert into public.guardian_sessions (user_id, guardian_id, note, ends_at)
  values (auth.uid(), guardian, start_guardian.note, now() + make_interval(mins => minutes))
  returning guardian_sessions.id into new_id;
  return new_id;
end;
$$;

create function public.end_guardian(session_id uuid, safe boolean)
returns void
language sql security invoker set search_path = public, extensions
as $$
  update public.guardian_sessions
     set status = case when safe then 'safe' else 'alarm' end
   where id = session_id and user_id = auth.uid();
$$;

-- Both roles, recent sessions only (guardians still see just-expired ones
-- so the "hasn't checked in" warning can show).
create function public.my_guardian_sessions()
returns table (
  id uuid,
  role text, -- 'protege' | 'guardian'
  other_id uuid,
  other_name text,
  other_avatar_url text,
  other_avatar_emoji text,
  note text,
  status text,
  started_at timestamptz,
  ends_at timestamptz
)
language sql security invoker stable set search_path = public, extensions
as $$
  select g.id,
         case when g.user_id = auth.uid() then 'protege' else 'guardian' end,
         p.id, p.display_name, p.avatar_url, p.avatar_emoji,
         g.note, g.status, g.started_at, g.ends_at
  from public.guardian_sessions g
  join public.profiles p
    on p.id = case when g.user_id = auth.uid() then g.guardian_id else g.user_id end
  where (g.user_id = auth.uid() or g.guardian_id = auth.uid())
    and g.ends_at > now() - interval '12 hours'
  order by g.started_at desc
  limit 20;
$$;

revoke execute on function public.my_event_history() from public, anon;
revoke execute on function public.start_guardian(uuid, integer, text) from public, anon;
revoke execute on function public.end_guardian(uuid, boolean) from public, anon;
revoke execute on function public.my_guardian_sessions() from public, anon;
grant execute on function public.my_event_history() to authenticated;
grant execute on function public.start_guardian(uuid, integer, text) to authenticated;
grant execute on function public.end_guardian(uuid, boolean) to authenticated;
grant execute on function public.my_guardian_sessions() to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.guardian_sessions;
  end if;
end $$;
