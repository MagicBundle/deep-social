-- Deep Social — 0005_friends.sql
-- Friend system: requests, acceptance, removal. Apply after 0004.
--
-- Model: one row per relationship, keyed (requester, addressee), with
-- status pending|accepted. Requesting someone who already requested you
-- auto-accepts (the intent is mutual). RLS scopes every row to its two
-- participants; nobody else can see who is friends with whom.

set search_path = public, extensions;

create table public.friendships (
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

create index friendships_addressee_ix on public.friendships (addressee_id);

alter table public.friendships enable row level security;
grant select, insert, update, delete on public.friendships to authenticated;

create policy "participants read own friendships"
  on public.friendships for select to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

create policy "users request as themselves"
  on public.friendships for insert to authenticated
  with check (requester_id = auth.uid() and status = 'pending');

create policy "addressee responds"
  on public.friendships for update to authenticated
  using (addressee_id = auth.uid()) with check (addressee_id = auth.uid());

create policy "either party removes"
  on public.friendships for delete to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

-- Request (or auto-accept a counter-request). Returns resulting status.
create function public.request_friend(target uuid)
returns text
language plpgsql security invoker set search_path = public, extensions
as $$
declare
  cur text;
begin
  if target = auth.uid() then
    raise exception 'cannot befriend yourself';
  end if;
  select f.status into cur from public.friendships f
   where (f.requester_id = auth.uid() and f.addressee_id = target)
      or (f.requester_id = target and f.addressee_id = auth.uid());
  if cur = 'accepted' then
    return 'accepted';
  end if;
  if cur = 'pending' then
    -- they already asked us -> requesting back means yes
    update public.friendships
       set status = 'accepted', responded_at = now()
     where requester_id = target and addressee_id = auth.uid() and status = 'pending';
    if found then return 'accepted'; end if;
    return 'pending';
  end if;
  insert into public.friendships (requester_id, addressee_id)
  values (auth.uid(), target);
  return 'pending';
end;
$$;

create function public.respond_friend(requester uuid, accept boolean)
returns void
language plpgsql security invoker set search_path = public, extensions
as $$
begin
  if accept then
    update public.friendships
       set status = 'accepted', responded_at = now()
     where requester_id = respond_friend.requester
       and addressee_id = auth.uid()
       and status = 'pending';
  else
    delete from public.friendships f
     where f.requester_id = respond_friend.requester
       and f.addressee_id = auth.uid()
       and f.status = 'pending';
  end if;
end;
$$;

create function public.remove_friend(target uuid)
returns void
language plpgsql security invoker set search_path = public, extensions
as $$
begin
  delete from public.friendships f
   where (f.requester_id = auth.uid() and f.addressee_id = target)
      or (f.requester_id = target and f.addressee_id = auth.uid());
end;
$$;

-- Everything the Friends tab needs in one call.
create function public.my_friendships()
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  interests text[],
  state text,   -- 'friend' | 'incoming' | 'outgoing'
  since timestamptz
)
language sql security invoker stable set search_path = public, extensions
as $$
  select p.id, p.display_name, p.avatar_url, p.interests,
         case
           when f.status = 'accepted' then 'friend'
           when f.addressee_id = auth.uid() then 'incoming'
           else 'outgoing'
         end as state,
         f.created_at
  from public.friendships f
  join public.profiles p
    on p.id = case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
  where f.requester_id = auth.uid() or f.addressee_id = auth.uid()
  order by f.created_at desc;
$$;

revoke execute on function public.request_friend(uuid) from public, anon;
revoke execute on function public.respond_friend(uuid, boolean) from public, anon;
revoke execute on function public.remove_friend(uuid) from public, anon;
revoke execute on function public.my_friendships() from public, anon;
grant execute on function public.request_friend(uuid) to authenticated;
grant execute on function public.respond_friend(uuid, boolean) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.my_friendships() to authenticated;

-- Live updates for the Friends tab (RLS keeps events participant-only).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.friendships;
  end if;
end $$;
