-- Minimal stand-in for the Supabase surface the migration expects.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;

create schema auth;
-- Supabase grants API roles usage on auth (auth.uid() is called from RLS
-- policies and invoker functions); mirror that.
grant usage on schema auth to anon, authenticated;

create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

-- Supabase's auth.uid() reads the JWT subject; locally we read a GUC that
-- tests set via set_config('request.jwt.claim.sub', ...).
create function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
