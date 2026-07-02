# Local schema tests

Assertion-based smoke tests for the migration, runnable against any local
PostgreSQL 15+ with PostGIS (no Supabase project needed). `local_stub.sql`
recreates the minimal Supabase surface (`anon`/`authenticated` roles,
`auth.users`, `auth.uid()` backed by a session GUC).

```bash
createdb deepsocial_test
psql -d deepsocial_test -v ON_ERROR_STOP=1 -f supabase/tests/local_stub.sql
psql -d deepsocial_test -v ON_ERROR_STOP=1 -f supabase/migrations/0001_init.sql
psql -d deepsocial_test -v ON_ERROR_STOP=1 -f supabase/tests/smoke.sql
```

A clean run ends with `ALL BACKBONE SMOKE TESTS PASSED`. Covered: signup
trigger, nearby_profiles (radius, distances, privacy tiers, self-exclusion,
freshness), create_post/nearby_posts, column-grant lockdown of raw
coordinates, RLS write isolation. Last verified on Postgres 17 / PostGIS 3.6.
