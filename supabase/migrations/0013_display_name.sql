-- Deep Social — 0013_display_name.sql
-- Users may now choose their own display name (privacy: no longer forced to
-- show the real name from Google/Apple). display_name is already updatable
-- (grant + "users update own profile" RLS from 0001); this only guards its
-- length server-side. Apply after 0012.

set search_path = public, extensions;

-- Keep any existing over-length names valid before adding the constraint.
update public.profiles
   set display_name = left(display_name, 40)
 where char_length(display_name) > 40;

alter table public.profiles
  add constraint profiles_display_name_len
  check (char_length(display_name) between 1 and 40);
