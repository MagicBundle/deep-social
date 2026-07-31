# Roadmap — brain-trust synthesis (July 2026)

*Produced by a multi-agent review (three adversarial lenses — solo-reality,
stage-fit, user-value — plus a synthesis chair that verified every code claim
against the repo; a five-perspective panel was lost to a machine interruption
and its absence was judged non-material). Every file/line claim below was
re-verified by hand before this document was committed.*

## Where the project stands

The project is not blocked on product, design, or engineering — it is blocked
on ~90 minutes of production wiring untouched since July 19.
`docs/LAUNCH-CHECKLIST.md` is 0/18 ticked; migrations `0016`–`0019` are
written and smoke-tested but not applied, so the live build ships a Report
button whose RPC doesn't exist server-side, no age record, no retention
sweep, no Observer default. The parked decisions ("awaiting beta feedback")
are deadlocked: they need feedback → feedback needs testers → testers need
the checklist. **The scarce resource is operator attention, not code.**

## Do first (operator, one sitting, ~90 min)

1. Apply `0016`→`0019` in the Supabase SQL editor, in order; run the
   verification query in `docs/LAUNCH-CHECKLIST.md` §A.
2. Insert the moderation-contact row; redeploy the push Edge Function
   (without it the 24 h review promise in TERMS.md is unhonoured).
3. Schedule the retention pg_cron job (3 lines, `docs/RETENTION.md`).
4. Confirm the Supabase project region (US would contradict the published
   privacy notice; migrating is free at 1 tester). Note: the encryption
   declaration is already committed (`fe0c67a`) — that checklist row is done.
5. Real support email to replace GitHub Issues (DSA point-of-contact +
   Apple support field).

## Next 3 builds

1. **First-run interest picker** — after OAuth, before the map. New profiles
   seed `interests: []` (App.tsx) and the only way to set them is a buried
   menu modal; since Discover matching is two-sided, an untouched profile is
   simultaneously undiscoverable and sees an empty Discover. *An afternoon.*
2. **Demo-event asymmetry fix** — demo *people* retract at ≥3 real members
   nearby; demo *events* never do (`displayWorld.events` is unconditional).
   Real users permanently see fabricated events at real Luxembourg venues
   with Join and Share live — a WhatsApp share would spread a fake event's
   deep link. Label unmistakably, disable Share, retract on the same rule.
   *Half a day.*
3. **"Invite a friend" button** — the connect link exists
   (`buildConnectLink`) but is framed only as the in-person QR handshake;
   there is no invite affordance anywhere (zero matches for "invite" in
   src/). Friend-to-friend is the entire distribution model. *An afternoon.*

## Worth watching (after the above)

- **Web push** for friend-request / accepted / DM — `registerPush` no-ops
  off-native, so web testers have no session-2 trigger at all.
- **Measurement without trackers** — one saved SQL query run weekly:
  signups, % with ≥1 interest, requests sent vs accepted, DMs, real pins,
  D2/D7 return. No SDK, no privacy-label change.
- **Cluster recruitment** — 8–10 people who already go out together, one
  neighbourhood, one real Friday night. Scattered testers ≈ zero density.
  Boldest cheap experiment: run the first cluster night in person, map open.
- **Custom domain** (~€10/yr) — the github.io URL reads as phishing in a
  WhatsApp invite. Universal links stay parked.
- **Storage orphans** — retention discards returned photo paths (pg_cron
  variant); bucket needs an occasional manual sweep + one honest sentence
  in PRIVACY.md.

## Rejected by the panel (2+ skeptics)

- Bottom tab-bar restructure — destroys the evidence it was parked to collect.
- Monetization build-out — can't price visibility on an empty map.
- Meta login — Apple+Google covers every phone here.
- Scale/performance hardening — optimizing for load that doesn't exist.
- Constellation/Guardian/recap polish — structurally empty in sessions 1–3.
- Any third-party analytics SDK — torches a documented differentiator.

## The one risk that matters

**Throughput.** Feature-complete product, 19 migrations, ~40 RPCs, full
GDPR/DSA scaffolding — and none of it switched on in production. Every hour
debating what to build next competes with "turn on what you already built."
Second-order: shipping fabricated events that never retract into a country
small enough for reputation to be permanent. Checklist → demo events →
invite people, in that order.
