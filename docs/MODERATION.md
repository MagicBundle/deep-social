# Moderation playbook (internal)

The Terms promise: **every report reviewed and acted on within 24 hours**,
a **statement of reasons** for every action, and a **re-review on request**.
This is the operator's checklist that makes those promises real. It doubles
as documentation of process for DSA purposes (notice-and-action, Art. 16;
statements of reasons, Art. 17).

## How reports arrive

- Users report pins, photos, profiles, and DM conversations in-app
  (`report_content` RPC → `public.reports`).
- You get a push notification ("⚑ New content report") on every report,
  provided your user id is in `moderation_contacts`:

  ```sql
  insert into public.moderation_contacts (user_id) values ('<your-user-uuid>');
  ```

  (One-time setup per operator account, SQL editor. The table has no API
  access; only the dashboard/service role can read it.)

## Triage (within 24 h of the report)

1. Open the Supabase dashboard → `reports`, filter `status = 'open'`.
2. Look at the reported thing (`target_kind` + `target_id`; `reported_user_id`
   is resolved for you) and the reason.
3. Decide, using the Terms' prohibited list as the yardstick:
   - **No violation** → `status = 'dismissed'`, note why in `resolution_note`.
   - **Violation** → remove the content (delete the row / storage object) or
     restrict the account, then `status = 'actioned'` + `resolution_note`.
   - **Possibly criminal content** (CSAM, credible threats): act immediately,
     preserve evidence (screenshot + row copy) BEFORE removal, and report to
     the Luxembourg police / relevant authority. Do not merely delete.
4. Always set `resolved_at = now()`.

Severity ladder for account measures: warning → temporary suspension →
termination. Escalate on repeat or egregious violations. (Suspension during
beta = block via dashboard or delete the offending rows; a formal suspension
flag can be added when volume justifies it.)

## Statement of reasons (send on every action)

Send via DM if the account is still active, otherwise to the email on the
profile. Template:

> Hi — your [pin/photo/message/account] "[title or excerpt]" was
> [removed/restricted] on [date] because it violated our Terms of Use:
> [specific clause, e.g. "harassment, threats, hate"]. The decision was made
> by a human after a user report. If you think this is wrong, reply here or
> open an issue at github.com/MagicBundle/deep-social/issues and it will be
> re-reviewed. You can also complain to the Luxembourg Digital Services
> Coordinator (Autorité de la concurrence, guichet.lu → DSA) or go to court.

## Re-review (appeal)

If someone contests a decision: a fresh look at the original report, the
content, and their argument — within 7 days. Outcome and reasoning go into
`resolution_note` (append, don't overwrite). Reinstate if wrong.

## Log

`public.reports` **is** the moderation log (report → decision → note →
timestamps). Don't delete rows; dismissed reports are part of the record.
