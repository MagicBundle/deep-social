-- Deep Social — 0012_push_tokens.sql
-- Device push-notification tokens (receive/registration foundation).
-- The send side is a Supabase Edge Function (service role) that reads a
-- target user's tokens and pushes to APNs — added once the APNs key exists.
-- Apply after 0011.

set search_path = public, extensions;

create table public.device_push_tokens (
  token      text primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  platform   text not null default 'ios' check (platform in ('ios', 'android', 'web')),
  updated_at timestamptz not null default now()
);

create index device_push_tokens_user_ix on public.device_push_tokens (user_id);

alter table public.device_push_tokens enable row level security;
grant select, insert, update, delete on public.device_push_tokens to authenticated;

create policy "users read own tokens"
  on public.device_push_tokens for select to authenticated using (user_id = auth.uid());
create policy "users write own tokens"
  on public.device_push_tokens for insert to authenticated with check (user_id = auth.uid());
create policy "users update own tokens"
  on public.device_push_tokens for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users delete own tokens"
  on public.device_push_tokens for delete to authenticated using (user_id = auth.uid());

-- Definer so a device that changes hands (same APNs token, new signed-in
-- user) can reclaim its token — the function only ever assigns it to the
-- caller, so this is safe.
create function public.register_push_token(p_token text, p_platform text default 'ios')
returns void
language plpgsql security definer set search_path = public, extensions
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into public.device_push_tokens (token, user_id, platform, updated_at)
  values (p_token, auth.uid(), p_platform, now())
  on conflict (token)
    do update set user_id = auth.uid(), platform = excluded.platform, updated_at = now();
end;
$$;

create function public.unregister_push_token(p_token text)
returns void
language sql security invoker set search_path = public, extensions
as $$
  delete from public.device_push_tokens
   where token = p_token and user_id = auth.uid();
$$;

revoke execute on function public.register_push_token(text, text) from public, anon;
revoke execute on function public.unregister_push_token(text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;
