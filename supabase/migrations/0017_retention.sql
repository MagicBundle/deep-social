-- Deep Social — 0017_retention.sql
-- GDPR storage-limitation (P1): one idempotent sweep that prunes data past
-- its useful life. Schedule it (pg_cron / a scheduled Edge Function / a CI
-- cron) — see docs/RETENTION.md. SECURITY DEFINER because it must bypass RLS
-- to touch every user's rows, and granted to service_role ONLY so no app
-- user can ever invoke it. Returns the storage paths it orphaned so the
-- scheduler can delete the actual photo files (a DB delete can't).
-- Apply after 0016.

set search_path = public, extensions;

create or replace function public.run_data_retention()
returns table (deleted_storage_path text)
language plpgsql security definer set search_path = public, extensions
as $$
declare
  stale_ids uuid[];
begin
  -- 1) Expired "tonight's vibe" tags (reads already treat them gone after 3 h)
  update public.profiles
     set current_vibe = null, vibe_set_at = null
   where vibe_set_at is not null
     and vibe_set_at < now() - interval '3 hours';

  -- 2) Dormant presence: drop a stale last position. It is never shown past
  --    2 h anyway; storage-limitation says don't keep it sitting in the row.
  update public.profiles
     set last_location = null, location_updated_at = null
   where location_updated_at is not null
     and location_updated_at < now() - interval '24 hours';

  -- 3) Dead device push tokens (not refreshed in 60 days)
  delete from public.device_push_tokens
   where updated_at < now() - interval '60 days';

  -- 4) Ended guardian sessions older than 30 days (keep active + recent)
  delete from public.guardian_sessions
   where status <> 'active'
     and ends_at < now() - interval '30 days';

  -- 5) Long-past event pins (ended > 30 days ago) — UNLESS a report about the
  --    pin or one of its photos is still open, so moderation evidence is
  --    never destroyed out from under an open case.
  select array_agg(po.id) into stale_ids
    from public.posts po
   where po.starts_at + make_interval(mins => po.duration_min) < now() - interval '30 days'
     and not exists (
       select 1
         from public.reports r
        where r.status = 'open'
          and (
            (r.target_kind = 'pin' and r.target_id = po.id)
            or (r.target_kind = 'media' and r.target_id in (
                  select m.id from public.media_attachments m where m.post_id = po.id))
          )
     );

  if stale_ids is not null then
    -- surface the files that will be orphaned (caller removes them from storage)
    return query
      select m.storage_path
        from public.media_attachments m
       where m.post_id = any(stale_ids);

    -- drop the pins — cascades to attendees and media_attachments rows
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
