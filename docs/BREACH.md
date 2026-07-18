# Personal-data breach playbook (internal)

GDPR Arts. 33–34. The clock is **72 hours from becoming aware** for the
regulator notification, so the plan has to exist before the incident.

## The first hour

1. **Contain**: rotate the leaked credential (Supabase dashboard → API keys /
   Auth settings), revoke compromised sessions, disable the affected function
   or bucket. If the app itself is the leak, push a fix or take Pages down.
2. **Preserve evidence**: export relevant Supabase logs (Dashboard → Logs),
   copy of the vulnerable code, timestamps of first/last known exposure.
3. **Write down "aware since"** — the 72 h countdown starts here.

## Assess (same day)

- What categories? (this app: names/emails, precise or fuzzed locations,
  private messages, photos, social graph, report contents)
- Whose, and how many?
- Risk to people: location data + social graph = treat as **high risk** by
  default in this app; a leak of DMs or of who-blocked-whom likewise.
- Record the assessment in writing, even if the conclusion is "no risk, no
  notification" — Art. 33(5) requires documenting every breach internally.

## Notify

- **CNPD (within 72 h)** unless risk is unlikely: use the CNPD's data-breach
  notification form — cnpd.public.lu → "Data breach notification". Partial
  notification ("in phases") is allowed if facts are still emerging — do not
  wait for a complete picture to start.
- **Affected users (without undue delay)** when risk is *high* (for location /
  DM / social-graph exposure, assume yes): in-app + email, plain language —
  what leaked, when, what we did, what they should do (e.g. change linked
  account passwords, review who can see them), contact point.
- **Processors**: if the breach originates at Supabase/GitHub, their notice
  starts our clock; we still own the CNPD/user notifications as controller.

## Template (user notice)

> On [date] we discovered that [what] was accessible to [whom] between
> [dates]. This included your [data categories]. We fixed it by [action] on
> [date]. What you can do: [steps]. We're sorry — questions and concerns:
> [contact email / GitHub issues]. You may also complain to the CNPD
> (cnpd.public.lu).

## Afterwards

Post-mortem in the repo (private note is fine): root cause, fix, what
detection was missing. Add the missing guard to the smoke tests if it was a
policy/grant gap — that's how every RLS hole here gets a permanent test.
