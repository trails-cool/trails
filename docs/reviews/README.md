# Reviews

Point-in-time review decks. Self-contained HTML — open directly in a
browser (arrow keys / click to navigate). Each is a snapshot of its
date; findings were triaged and tracked through PRs, so the deck reads
as the "why" behind a batch of follow-up work rather than a live
checklist.

- **`architecture-review-2026-06-10.html`** — deepening opportunities
  (shallow modules, implicit interfaces, duplicated choreography). The
  10 candidates were implemented across PRs that reference them as
  "candidate N from the 2026-06-10 review".

- **`security-review-2026-06-10.html`** — defensive review of the auth,
  federation, secrets, and injection surfaces. Severity-calibrated
  (several scanner false-positives were verified and dropped). All
  actionable findings were fixed in follow-up PRs.
