## Why

To demo trails.cool to prospective users and contributors we need live-looking content on the public surface introduced by `public-content-visibility`. Today a demo link opens to an empty profile. Even after visibility ships, the Journal has 3 users and 0 activities — the feed shows "nothing happened today," which is the worst possible first impression.

A synthetic "demo" user that autonomously produces plausible activities closes that gap. It also keeps pressure on the content-creation code paths: if the bot is wedged, the import / routing / geometry pipelines are probably broken for real users too.

This change is the direct follow-up to `public-content-visibility` and is only useful once that lands.

## What Changes

- A dedicated bot user account (username e.g. `demo`) is bootstrapped on first run with a stable ID, a public display name, and `visibility` defaults that mark its content public.
- A recurring pg-boss job (the existing background-jobs infrastructure on the Journal host) runs every few hours, chooses a random start + end point within a configured seed region, asks BRouter for a route, persists the route + a derived activity attributed to the demo user with `visibility = 'public'`.
- Synthetic rows are explicitly flagged at the database level (`synthetic boolean NOT NULL DEFAULT false`) so a single DELETE can clean them up and listings can optionally exclude them later.
- A retention job trims synthetic activities older than a configurable window (default 14 days) so the feed looks fresh, not a swamp of old rides.
- Everything is gated behind a `DEMO_BOT_ENABLED` env flag. Local dev, CI, and tests default to disabled. The flag is set on prod only.
- Route profiles vary: trekking and fastbike, with plausible distance ranges for each. Start times of day look reasonable. Names and descriptions draw from a small templated copy set (in both EN and DE).

## Capabilities

### New Capabilities
- `demo-activity-bot`: A bot user, a scheduler that seeds plausible public routes + activities using BRouter and a seed region, and a retention job to keep the feed bounded.

### Modified Capabilities
- `route-management`: adds a `synthetic` flag alongside the `visibility` work from `public-content-visibility`, so listings and exports can distinguish bot content if they ever need to.
- `activity-feed`: same `synthetic` flag for symmetry.

## Impact

- **Code**: new `apps/journal/app/jobs/demo-bot.ts` for the job handlers, small helpers for picking seed coordinates and templating names, a one-time bootstrap that inserts the demo user if missing.
- **Data**: a schema change (the `synthetic` column on two tables) plus ongoing inserts into those same tables. Bounded by the retention job.
- **Infrastructure**: no new services — pg-boss is already in the stack. `DEMO_BOT_ENABLED` is a new env var on the prod Journal container.
- **External calls**: BRouter calls from the bot; throttled at the scheduler level so the bot never competes with real user traffic. No external API beyond BRouter.
- **Privacy**: the bot user has no real email, no PII, and its content is clearly author-attributed to `demo`. The legal / privacy pages do not need to change — this is first-party content the operator controls.
- **Non-goals (explicit)**: realistic social signals (no likes/comments on demo content), multi-user bot personas (one user for v1), cross-region variety (one seed region), multi-day tours, photos or media attachments.
- **Rollback**: flip `DEMO_BOT_ENABLED=false` — the job stops. A single `DELETE FROM ... WHERE synthetic = true` removes all bot content without touching real data.
