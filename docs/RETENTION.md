# Data retention schedule (internal)

GDPR storage-limitation, made concrete. The `run_data_retention()` function
(migration 0017) enforces the starred rows; the rest are structural (deleted
with the account, or kept deliberately with a reason).

| Data | Kept for | Enforced by |
|---|---|---|
| "Tonight's vibe" tag | 3 h (reads ignore it after 3 h) | sweep ★ |
| Last map position | 24 h after last update (invisible to others after 2 h) | sweep ★ |
| Device push tokens | 60 days without refresh (sign-out deletes immediately) | sweep ★ |
| Guardian sessions (ended) | 30 days after end; active ones never touched | sweep ★ |
| Event pins + their photos | 30 days after the event ends — **unless a report on them is still open** | sweep ★ |
| Direct messages | Until either account is deleted (deletion cascade) | account deletion |
| Profile (name, avatar, interests, Instagram, age confirmation) | Life of the account | account deletion |
| Friendships, blocks, attendance | Life of the account | account deletion |
| Reports (the moderation log) | Kept — evidence of how cases were handled (DSA) | manual review |

## Running the sweep

The function is `security definer`, executable **only** by `service_role` —
no app user can trigger it.

**Option A — pg_cron (recommended, zero moving parts).** In the Supabase SQL
editor (pg_cron is pre-installed on Supabase):

```sql
create extension if not exists pg_cron;
select cron.schedule('deep-social-retention', '20 4 * * *',  -- daily 04:20 UTC
  $$select public.run_data_retention();$$);
```

Caveat: pg_cron discards the returned storage paths, so photo *files* of
pruned pins stay in the `vibes` bucket until cleaned. At beta scale that is
acceptable (rows are gone, so nothing links to them); clear the bucket
occasionally from the dashboard, or use Option B.

**Option B — scheduled script (also deletes the photo files).** Anything with
the service key (a GitHub Actions cron works) can do:

```js
const { data: paths } = await admin.rpc('run_data_retention')
if (paths?.length) await admin.storage.from('vibes')
  .remove(paths.map((p) => p.deleted_storage_path))
```

Verify it ran: `select * from cron.job_run_details order by start_time desc limit 5;`
