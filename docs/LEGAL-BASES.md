# Legal bases for processing (internal, GDPR Art. 6)

One row per processing operation, so nothing rides on blanket consent. The
Privacy Notice reflects this mapping; keep the two in sync.

| Processing | Basis | Notes |
|---|---|---|
| Account (name, email, avatar from Apple/Google), profile you edit (display name, avatar emoji, interests, Instagram) | **Contract** (Art. 6(1)(b)) — providing the service you signed up for | Withdrawing = deleting the account (self-serve) |
| Event pins, photos, DMs, attendance, friendships you create | **Contract** — this *is* the service | Same |
| Appearing as an anonymous **Observer** (interests only, no name/photo, location blurred to ~500 m) — the default | **Legitimate interest** (Art. 6(1)(f)) — a social-discovery map needs some default presence to be useful; low-risk because anonymous + blurred, disclosed at sign-up, with a one-tap opt-out to Ghost | Balancing favours LI; confirm with counsel before public launch |
| Being fully identified to strangers (**Beacon**) | **Consent** (Art. 6(1)(a)) — never a default, granular, revocable anytime | Explicit opt-in only |
| Broadcasting "tonight's vibe" | **Consent** — setting it is the consent; clearing it or the 3 h expiry revokes | |
| Age confirmation timestamp | **Legal obligation / legitimate interest** — evidence of Art. 8 "reasonable efforts" | Set once |
| Blocks, reports, moderation log | **Legitimate interest** (Art. 6(1)(f)) — keeping the service safe; also DSA compliance | Balancing: reported users' data kept only in the report row |
| Push tokens | **Contract** — delivering notifications you enabled; OS-level opt-in on top | Deleted on sign-out, swept at 60 d |
| Security logs (Supabase auth/infra) | **Legitimate interest** — abuse prevention | Processor-side |

Not used: no profiling for ads (no ads), no automated decisions with legal
effect, no special-category data collected on purpose (free-text fields could
incidentally contain some — moderation removes abuse; we don't mine them).

Minors: service is 16+ (gate + store rating); no basis is relied on for
under-16 data because under-16 use is not permitted.
