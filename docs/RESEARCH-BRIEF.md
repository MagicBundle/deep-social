# Deep Social — Research Brief

*A self-contained description of the project's aims, methods, and open
challenges, written for ingestion by external tools and platforms. Companion
to [OVERVIEW.md](OVERVIEW.md) (full product & architecture briefing) and
[ROADMAP.md](ROADMAP.md) (current priorities). Last updated: August 2026.*

*Framing note: Deep Social is an independent product-development project, not
a formal academic study. It is described here in research terms because its
development is organized around explicit hypotheses, instrumented methods,
and falsifiable open questions — but there is no institutional affiliation,
IRB protocol, or external funding to disclose.*

---

## 1. Project summary

Deep Social is a **map-forward social network** in beta, built by a solo
independent developer (Luxembourg) with AI-agent-driven engineering. The map
is the home screen: people and events appear as live, interest-tagged pins,
and the product compresses the distance between "I notice you exist" and "we
met in real life" into a few taps. It is privacy-first by architecture — new
users appear only as anonymous, location-blurred dots; identification is
opt-in; invisibility is one tap away — and targets EU launch (Apple App
Store + web) under full GDPR/DSA compliance.

## 2. Research aims

The project is organized around five questions:

**A. Interaction design — can a live map convert online discovery into
real-world meetings?** The core hypothesis is that a feed optimizes for
consumption while a map optimizes for action, and that an explicit
interaction ladder (*See → Filter → Discover → Connect → Chat → Meet →
Remember*) produces measurably more in-person meetings per session than
feed-shaped alternatives.

**B. Privacy-preserving discovery — how much utility survives radical data
minimization?** The app enforces a graduated visibility ladder (Ghost /
Observer / Beacon) in the database itself, never stores movement history,
expires presence within hours, and runs zero trackers. The open question is
whether a discovery graph built on anonymous-by-default, blurred, expiring
presence can still generate enough perceived social density to be useful.

**C. Cold-start dynamics in a small market.** Luxembourg (~660k, WhatsApp-
first culture) is deliberately chosen as a bounded testbed. The project
probes whether a *labeled, self-retracting simulation* (a "demo world" of
simulated people and events that yields automatically once ≥3 real members
are nearby) can bridge the empty-map phase without eroding trust, and
whether hyper-local cluster seeding (8–10 socially connected users, one
neighborhood, one recurring real event) beats broad recruitment.

**D. Compliance as architecture at solo-operator scale.** GDPR and DSA
obligations (notice-and-action, statements of reasons, retention limits,
age assurance, breach readiness) are implemented as database structure —
row-level security, column-grant minimization, server-side ladders, an
auditable moderation log, an automated retention sweep with an
evidence-preservation guard — rather than as policy documents. The question:
can one non-professional operator lawfully and safely run a UGC platform
where strangers meet in person?

**E. Methodological — AI-agent-driven engineering with adversarial
verification.** All engineering is performed by an AI agent under human
direction. The working method under evaluation: every schema change is
replayed and assertion-tested on a scratch database before shipping; every
UI change is empirically verified in a live browser; substantive changes
face multi-agent adversarial review before commit (a recent three-lens
review of one feature surfaced nine grounded defects pre-ship, several
severe). The open question is whether this discipline sustains professional
quality without a human engineering team.

## 3. Methods

- **Architecture:** thin static web client (Vite/React/TypeScript/Leaflet)
  with no custom server; Supabase-managed Postgres + PostGIS backend where
  all trusted logic lives in ~40 stored procedures behind row-level
  security; 19 sequential, individually smoke-tested SQL migrations; a
  Capacitor iOS shell wrapping the same build (TestFlight).
- **Privacy engineering:** sensitive columns (raw coordinates, email) carry
  no API read grants at all and surface only through procedures that apply
  visibility rules first; friends-only fields are structurally unreadable
  otherwise; blocking is bidirectional and silent; photos are EXIF-stripped
  client-side; retention is enforced by a scheduled sweep, not promised.
- **Verification protocol:** scratch-Postgres replay of the full migration
  chain with security assertions (cross-user writes must fail, ladders must
  hold, unmasking joins must be blocked); in-browser behavioral verification
  of every UI change before commit; multi-agent adversarial review
  (independent lenses attempting to refute the change, findings fixed and
  re-verified) for substantive features.
- **Measurement without surveillance:** no analytics SDKs, ever (a published
  differentiator). Beta metrics come from a weekly hand-run SQL query over
  the app's own operational tables: signups, interest adoption, friend
  requests sent vs. accepted, DMs, real pins created, D2/D7 return.
- **Field method (planned):** hyper-local cluster launches with in-person
  observation — the operator present, map open, at the first seeded events —
  in place of remote instrumentation.

## 4. Current state (August 2026)

Feature-complete beta: live web app; iOS build on TestFlight (~1 external
tester); bilingual (EN/FR) legal layer published; universal reporting, age
gate, retention, and moderation tooling built and tested. Three
brain-trust-prioritized builds shipped in the latest cycle (first-run
interest onboarding; demo-world containment and retraction symmetry;
friend-invitation affordance in progress). Production activation of the
compliance layer (four tested-but-unapplied migrations plus operator setup,
~90 minutes of dashboard work) is the current gate — tracked in
[LAUNCH-CHECKLIST.md](LAUNCH-CHECKLIST.md).

## 5. Ongoing challenges and goals

**Near-term (weeks):**
- Apply the pending migration block and operator wiring; flip the built
  compliance layer live.
- Complete the invitation affordance (the sole distribution mechanism is
  friend-to-friend; the link plumbing exists, the button does not yet).
- First cluster-seeding experiment: one neighborhood, one recurring event,
  8–10 connected users; direct observation of first sessions.
- Stand up the weekly no-tracker metrics query as the beta's instrument.

**Open tensions (the interesting ones):**
- **Privacy defaults vs. density:** the recent shift of the default from
  invisible (Ghost) to anonymous-blurred (Observer) trades a stricter
  default for map liveliness, resting on a legitimate-interest basis that
  should be confirmed with counsel before public launch. Whether the ladder
  can hold against density pressure as the network grows is the project's
  central design tension.
- **Presence expiry vs. discovery:** two-hour presence freshness makes the
  map honest but starves discovery in low-density phases; the right decay
  parameters are an open empirical question.
- **WhatsApp gravity:** in a WhatsApp-first culture every successful
  connection risks exporting the relationship out of the app (the reason
  phone-number sharing was deliberately rejected); whether in-app chat can
  hold the "deepest tier" of contact is unresolved.
- **Moderation SLA realism:** a published 24-hour human review commitment
  against a solo operator's availability; mitigations (instant self-help via
  blocking, operator push alerts on every report) are live, but the
  commitment is untested at scale.

**Deferred by design (guardrails set, build withheld):**
- Monetization (never paywall the social graph or safety features);
  navigation restructure (awaiting behavioral evidence from beta); DSA
  scale-tier duties (formal appeals, transparency reporting) — scoped for
  when growth demands them.

## 6. Data & ethics posture

16+ only (age-gated with recorded confirmation; Luxembourg's GDPR age of
digital consent); per-operation legal bases documented (contract for the
service, consent only for identification and vibe broadcast, legitimate
interest for safety and the anonymous default); no third-party analytics or
advertising; self-serve account deletion with full cascade; published
bilingual privacy notice and terms; breach playbook (CNPD, 72h) and
moderation playbook maintained in-repo. Any external platform ingesting this
project's data should note: **operational tables contain personal data of
real beta users and are not exportable research data** — only aggregate,
non-identifying metrics leave the database.
