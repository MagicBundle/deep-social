-- Deep Social — 0014_instagram.sql
-- Opt-in Instagram handle on the profile. Friends-only BY DESIGN: the column
-- is deliberately excluded from the profiles SELECT grant, so it never leaks
-- through direct reads, nearby_profiles, or search. It surfaces only via
--   • get_my_profile()  — the owner's own row, and
--   • my_friendships()  — projected ONLY for accepted friends.
-- Apply after 0013.

set search_path = public, extensions;

alter table public.profiles
  add column instagram_handle text
  check (instagram_handle is null or instagram_handle ~ '^[A-Za-z0-9._]{1,30}$');

-- Owner may set/clear their own handle; the "users update own profile" RLS
-- policy from 0001 restricts writes to their row. Intentionally NO grant
-- select — that is what keeps the handle friends-only.
grant update (instagram_handle) on public.profiles to authenticated;

-- ── get_my_profile: expose the owner's own handle ───────────────────────
-- (return-type change ⇒ drop + recreate)
drop function public.get_my_profile();
create function public.get_my_profile()
returns table (
  id uuid,
  email text,
  display_name text,
  avatar_url text,
  avatar_emoji text,
  interests text[],
  visibility_mode text,
  current_vibe text,
  instagram_handle text,
  lat double precision,
  lng double precision,
  location_updated_at timestamptz
)
language sql security definer set search_path = public, extensions
stable
as $$
  select p.id, p.email, p.display_name, p.avatar_url, p.avatar_emoji, p.interests,
         p.visibility_mode,
         case when p.vibe_set_at > now() - interval '3 hours'
              then p.current_vibe end as current_vibe,
         p.instagram_handle,
         st_y(p.last_location::geometry) as lat,
         st_x(p.last_location::geometry) as lng,
         p.location_updated_at
  from public.profiles p
  where p.id = auth.uid();
$$;
revoke execute on function public.get_my_profile() from public, anon;
grant execute on function public.get_my_profile() to authenticated;

-- ── my_friendships: reveal a friend's handle, accepted-only ─────────────
-- Now SECURITY DEFINER so it can read instagram_handle (kept out of the
-- caller's column grant). It stays scoped to the caller's own friendships
-- via auth.uid() (the JWT claim resolves regardless of definer), and the
-- handle is projected ONLY when the friendship is accepted — never for a
-- pending incoming/outgoing request.
drop function public.my_friendships();
create function public.my_friendships()
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  avatar_emoji text,
  interests text[],
  state text,
  since timestamptz,
  instagram_handle text
)
language sql security definer set search_path = public, extensions
stable
as $$
  select p.id, p.display_name, p.avatar_url, p.avatar_emoji, p.interests,
         case
           when f.status = 'accepted' then 'friend'
           when f.addressee_id = auth.uid() then 'incoming'
           else 'outgoing'
         end as state,
         f.created_at,
         case when f.status = 'accepted' then p.instagram_handle end
  from public.friendships f
  join public.profiles p
    on p.id = case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
  where f.requester_id = auth.uid() or f.addressee_id = auth.uid()
  order by f.created_at desc;
$$;
revoke execute on function public.my_friendships() from public, anon;
grant execute on function public.my_friendships() to authenticated;
