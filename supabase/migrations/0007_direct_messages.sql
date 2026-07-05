-- Deep Social — 0007_direct_messages.sql
-- Direct messages between accepted friends. Apply after 0006.
--
-- Gate: you can only DM someone you are actually friends with (accepted
-- friendship). Enforced in the INSERT policy, so a modified client can't
-- message strangers. Reads are scoped to the two participants.

set search_path = public, extensions;

-- Definer so the friendship check is reliable inside the RLS policy,
-- regardless of the caller's row visibility. Returns only a boolean.
create function public.are_friends(a uuid, b uuid)
returns boolean
language sql stable security definer set search_path = public, extensions
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = a and f.addressee_id = b)
        or (f.requester_id = b and f.addressee_id = a))
  );
$$;

create table public.direct_messages (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  body         text not null check (char_length(body) between 1 and 2000),
  created_at   timestamptz not null default now(),
  read_at      timestamptz,
  check (sender_id <> recipient_id)
);

create index dm_pair_ix on public.direct_messages (sender_id, recipient_id, created_at);
create index dm_inbox_ix on public.direct_messages (recipient_id, read_at);

alter table public.direct_messages enable row level security;
grant select, insert on public.direct_messages to authenticated;
grant update (read_at) on public.direct_messages to authenticated;

create policy "participants read their DMs"
  on public.direct_messages for select to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid());

create policy "friends send DMs as themselves"
  on public.direct_messages for insert to authenticated
  with check (sender_id = auth.uid() and public.are_friends(auth.uid(), recipient_id));

-- Recipient may mark messages read (read_at is the only updatable column).
create policy "recipient marks read"
  on public.direct_messages for update to authenticated
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

create function public.send_dm(recipient uuid, body text)
returns uuid
language plpgsql security invoker set search_path = public, extensions
as $$
declare
  new_id uuid;
begin
  if not public.are_friends(auth.uid(), recipient) then
    raise exception 'can only message accepted friends';
  end if;
  insert into public.direct_messages (sender_id, recipient_id, body)
  values (auth.uid(), recipient, send_dm.body)
  returning direct_messages.id into new_id;
  return new_id;
end;
$$;

-- Full thread with one friend, oldest first, with a mine flag.
create function public.conversation(friend uuid)
returns table (id uuid, sender_id uuid, body text, created_at timestamptz, mine boolean)
language sql security invoker stable set search_path = public, extensions
as $$
  select d.id, d.sender_id, d.body, d.created_at, d.sender_id = auth.uid()
  from public.direct_messages d
  where (d.sender_id = auth.uid() and d.recipient_id = friend)
     or (d.sender_id = friend and d.recipient_id = auth.uid())
  order by d.created_at asc
  limit 500;
$$;

create function public.mark_dm_read(friend uuid)
returns void
language sql security invoker set search_path = public, extensions
as $$
  update public.direct_messages
     set read_at = now()
   where recipient_id = auth.uid() and sender_id = friend and read_at is null;
$$;

-- Per-friend unread counts, for badges.
create function public.dm_unread_counts()
returns table (friend_id uuid, unread integer)
language sql security invoker stable set search_path = public, extensions
as $$
  select sender_id, count(*)::int
  from public.direct_messages
  where recipient_id = auth.uid() and read_at is null
  group by sender_id;
$$;

revoke execute on function public.send_dm(uuid, text) from public, anon;
revoke execute on function public.conversation(uuid) from public, anon;
revoke execute on function public.mark_dm_read(uuid) from public, anon;
revoke execute on function public.dm_unread_counts() from public, anon;
grant execute on function public.send_dm(uuid, text) to authenticated;
grant execute on function public.conversation(uuid) to authenticated;
grant execute on function public.mark_dm_read(uuid) to authenticated;
grant execute on function public.dm_unread_counts() to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.direct_messages;
  end if;
end $$;
