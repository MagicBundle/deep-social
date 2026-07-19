-- Deep Social — 0018_observer_default.sql
-- New accounts now default to the anonymous **Observer** tier instead of
-- Ghost, so a real city renders an inhabited map instead of an empty one
-- (the density lever). Observer shows interests only — no name, no photo,
-- location blurred to ~500 m for strangers; precise position is stored only
-- so accepted friends can find you, and is never shown to strangers. Ghost
-- (invisible) and Beacon (fully identified) remain a deliberate switch.
--
-- Only the column DEFAULT changes: existing profiles keep whatever they
-- already chose — we never raise someone's visibility without their action.
-- Apply after 0017.

set search_path = public, extensions;

alter table public.profiles alter column visibility_mode set default 'observer';
