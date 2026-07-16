-- Deep Social — 0015_attendee_list.sql
-- "Who's going": expose an event's attendees so they can be tapped, WITHOUT
-- breaking the visibility ladder. Two parts:
--
--  1) Tighten the attendees SELECT policy. It was `using (true)`, which —
--     combined with the profiles display_name column grant — let any signed-in
--     client join attendees→profiles and unmask a Ghost/Observer who joined a
--     meetup. Every existing consumer (nearby_posts' `joined` flag, the
--     media_attachments insert check, the vibes storage policy) only ever asks
--     "am I an attendee", i.e. own rows, so own-rows-only is sufficient.
--
--  2) pin_attendees(): a definer RPC that applies the same rule as
--     nearby_profiles — friends and beacons are identified; observers and
--     ghosts are counted but anonymous. For anonymous rows the user_id is
--     withheld too: returning it would let the caller look the name up via
--     the display_name grant, which would defeat the whole point.
--
-- Apply after 0014.

set search_path = public, extensions;

drop policy "attendance readable by signed-in users" on public.attendees;

create policy "users read their own attendance"
  on public.attendees for select to authenticated
  using (user_id = auth.uid());

-- Who's going to this pin, filtered through the visibility ladder.
create function public.pin_attendees(p_post uuid)
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  avatar_emoji text,
  identified boolean,
  is_friend boolean
)
language sql security definer set search_path = public, extensions
stable
as $$
  with rows as (
    select p.id,
           p.display_name,
           p.avatar_url,
           p.avatar_emoji,
           a.created_at,
           public.are_friends(auth.uid(), p.id) as is_friend,
           -- yourself, your friends, and beacons are named; everyone else
           -- is an anonymous head-count
           (p.id = auth.uid()
            or public.are_friends(auth.uid(), p.id)
            or p.visibility_mode = 'beacon') as shown
      from public.attendees a
      join public.profiles p on p.id = a.user_id
     where a.post_id = p_post
       and not public.is_blocked(auth.uid(), p.id)
  )
  select case when r.shown then r.id end,
         case when r.shown then r.display_name end,
         case when r.shown then r.avatar_url end,
         case when r.shown then r.avatar_emoji end,
         r.shown,
         r.is_friend
    from rows r
   order by r.is_friend desc, r.shown desc, r.created_at
   limit 60;
$$;

revoke execute on function public.pin_attendees(uuid) from public, anon;
grant execute on function public.pin_attendees(uuid) to authenticated;
