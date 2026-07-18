-- Deep Social — 0016_reporting_age.sql
-- Launch-readiness compliance (P0):
--  1) Universal notice-and-action: reports extend beyond vibe photos to
--     pins, profiles and DM conversations (DSA Art. 16 / Apple 1.2), with
--     triage fields so moderation decisions leave an evidence trail.
--  2) moderation_contacts: who gets alerted on a new report (dashboard-
--     managed; the report RPC returns these ids so the reporting client
--     can fire a best-effort push — the DB row remains the source of truth).
--  3) profiles.age_confirmed_at: server-side record of the 16+ confirmation
--     given at sign-in ("reasonable efforts" evidence, GDPR Art. 8 / CNPD).
-- Apply after 0015.

set search_path = public, extensions;

-- ── 1) generalize reports ───────────────────────────────────────────────
alter table public.reports
  alter column media_id drop not null;

alter table public.reports
  add column target_kind text not null default 'media'
    check (target_kind in ('media', 'pin', 'profile', 'dm')),
  add column target_id uuid,
  add column reported_user_id uuid references public.profiles (id) on delete cascade,
  add column status text not null default 'open'
    check (status in ('open', 'actioned', 'dismissed')),
  add column resolution_note text,
  add column resolved_at timestamptz;

update public.reports set target_id = media_id where target_id is null;

-- one report per reporter per thing (media kept its original unique pair)
create unique index reports_target_reporter_ix
  on public.reports (target_kind, target_id, reporter_id);

-- Backfill reported_user_id for legacy media reports
update public.reports r
   set reported_user_id = m.user_id
  from public.media_attachments m
 where r.media_id = m.id and r.reported_user_id is null;

-- ── moderation contacts (no API grants: dashboard/service-role only) ────
create table public.moderation_contacts (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.moderation_contacts enable row level security;

-- ── report_content: one RPC for every kind ──────────────────────────────
-- definer: inserts bypass the column-level shape of the old policy and the
-- moderation_contacts table stays unreadable except through this narrow
-- window (ids returned only after a successful report). reporter is always
-- auth.uid(); reported_user resolved server-side so clients can't forge it.
create function public.report_content(
  p_kind   text,
  p_target uuid,
  p_reason text default null
)
returns setof uuid
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_reported uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_kind not in ('media', 'pin', 'profile', 'dm') then
    raise exception 'unknown report kind';
  end if;
  if p_reason is not null and char_length(p_reason) > 300 then
    raise exception 'reason too long';
  end if;

  if p_kind = 'media' then
    select m.user_id into v_reported from public.media_attachments m where m.id = p_target;
  elsif p_kind = 'pin' then
    select po.user_id into v_reported from public.posts po where po.id = p_target;
  else -- profile & dm: the target IS the user
    select p.id into v_reported from public.profiles p where p.id = p_target;
  end if;
  if v_reported is null then
    raise exception 'target not found';
  end if;
  if v_reported = auth.uid() then
    raise exception 'cannot report yourself';
  end if;

  insert into public.reports (media_id, target_kind, target_id, reported_user_id, reporter_id, reason)
  values (case when p_kind = 'media' then p_target end, p_kind, p_target, v_reported, auth.uid(), p_reason)
  on conflict (target_kind, target_id, reporter_id) do nothing;

  return query select mc.user_id from public.moderation_contacts mc;
end;
$$;

revoke execute on function public.report_content(text, uuid, text) from public, anon;
grant execute on function public.report_content(text, uuid, text) to authenticated;

-- keep the legacy vibe-photo entry point on the same rails
create or replace function public.report_media(media_id uuid, reason text default null)
returns void
language plpgsql security definer set search_path = public, extensions
as $$
begin
  perform public.report_content('media', report_media.media_id, report_media.reason);
end;
$$;

-- ── 3) age confirmation ─────────────────────────────────────────────────
alter table public.profiles add column age_confirmed_at timestamptz;
-- select too: the client's idempotent "set once" update reads the column
-- in its WHERE clause (timestamp is no more sensitive than created_at,
-- which carries the same grant)
grant select (age_confirmed_at) on public.profiles to authenticated;
grant update (age_confirmed_at) on public.profiles to authenticated;
