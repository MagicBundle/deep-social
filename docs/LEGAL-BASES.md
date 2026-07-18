# Legal bases for processing (internal, GDPR Art. 6)

One row per processing operation, so nothing rides on blanket consent. The
Privacy Notice reflects this mapping; keep the two in sync.

| Processing | Basis | Notes |
|---|---|---|
| Account (name, email, avatar from Apple/Google), profile you edit (display name, avatar emoji, interests, Instagram) | **Contract** (Art. 6(1)(b)) — providing the service you signed up for | Withdrawing = deleting the account (self-serve) |
| Event pins, photos, DMs, attendance, friendships you create | **Contract** — this *is* the service | Same |
| Sharing your live position with others (Observer/Beacon) | **Consent** (Art. 6(1)(a)) — off by default (Ghost), granular, revocable anytime in Privacy & visibility | The one place consent is the right tool |
| "Tonight's vibe" broadcast | **Consent** — setting it is the consent, clearing it (or 3 h expiry) revokes | |
| Age confirmation timestamp | **Legal obligation / legitimate interest** — evidence of Art. 8 "reasonable efforts" | Set once |
| Blocks, reports, moderation log | **Legitimate interest** (Art. 6(1)(f)) — keeping the service safe; also DSA compliance | Balancing: reported users' data kept only in the report row |
| Push tokens | **Contract** — delivering notifications you enabled; OS-level opt-in on top | Deleted on sign-out, swept at 60 d |
| Security logs (Supabase auth/infra) | **Legitimate interest** — abuse prevention | Processor-side |

Not used: no profiling for ads (no ads), no automated decisions with legal
effect, no special-category data collected on purpose (free-text fields could
incidentally contain some — moderation removes abuse; we don't mine them).

Minors: service is 16+ (gate + store rating); no basis is relied on for
under-16 data because under-16 use is not permitted.
