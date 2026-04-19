## Context

The Journal runs on a single Hetzner Cloud container with Postgres + PostGIS, BRouter as a sibling compose service, and pg-boss already configured as the background-job queue (`apps/journal/server.ts` boots a worker on startup). `public-content-visibility` introduces a `visibility` column on routes + activities; once that lands, a piece of content marked `public` is viewable by logged-out visitors at its permanent URL and on the owner's `/users/:username` profile.

This change layers a synthetic-content generator on top. The motivation is narrow — a non-empty feed for prospective users we're demoing to. The design matches that: **cheap, single-region, single-user, single-purpose**. Nothing here should generalise to "simulate a real community"; the bot is allowed to look slightly repetitive because it exists to fill an empty demo, not to fake scale.

Adjacent context:
- BRouter runs internally and already rate-limits per-session at the Planner, but here we're inside the Journal server, so the bot controls its own cadence rather than sharing a limiter with user-driven routing. Load is low — at most a handful of routes per day.
- pg-boss supports cron-style recurring schedules and singleton jobs (no concurrent duplicates), which are exactly what we need.

## Goals / Non-Goals

**Goals:**
- A logged-out visitor landing on `trails.cool/users/demo` sees a recent-looking public profile with several routes and activities.
- The content is generated entirely on-host, with no third-party data calls.
- Synthetic content is trivially separable from real content (single boolean flag).
- The bot can be disabled without a deploy (env flag) and its output wiped with a single DELETE.
- Cadence is boring. One content item every few hours is enough — we are not trying to pretend a Strava-scale community.

**Non-Goals:**
- Realistic social signals (likes, comments, follower counts).
- Multiple bot personas or multi-region coverage.
- Route topology tricks beyond "point-to-point via BRouter" (no multi-day, no loops, no no-go areas).
- Photos or media on activities.
- Running the bot in local dev / CI / staging — disabled by default everywhere except prod.

## Decisions

### Single bot user: Bruno the trail dog

**Decision:** One account with:

- Username: `bruno` (reserved; a later real registration with that username is blocked)
- Display name: `Bruno`
- Bio: short, whimsical, something like *"Professional park inspector. Currently accepting tennis balls."*
- Sentinel email: `bruno@<DOMAIN>` — unroutable, so magic-link login cannot succeed
- No passkey credentials
- `terms_accepted_at` / `terms_version` populated to the current values at bootstrap

The persona is a park-walking dog whose "human" logs the walks. This choice:

- Makes the bot legibly fictional at a glance — a dog account with emoji-laced names reads as *charming*, not as a real-user-you're-being-tricked-into-believing-in.
- Narrows the generator's parameter space (trekking profile only, short distances, urban parks) so output is consistent and failure-prone edge cases get pruned.
- Keeps the copy bank small and writable in one sitting.

**Alternatives considered:**
- **"Finn" — realistic commuter-cyclist.** Fills the feed convincingly, but deception risk if a visitor later realises. Rejected.
- **"trails.cool test pilot" — explicitly diagnostic.** Honest but dead boring; kills the "lively feed" goal the bot exists for. Rejected.
- **Multi-persona community simulation.** Out of scope for v1.

### Bruno's generation parameters

**Decision:** The persona constrains the generator more tightly than the generic v1 draft:

- **Profile pool**: `["trekking"]` only (dogs don't ride bikes).
- **Distance band**: 2–12 km crow distance between start and end — a realistic walk, not a hike.
- **Region**: Berlin inner (bbox roughly `13.25,52.45,13.55,52.60`), biased toward parks/green areas: Grunewald, Tiergarten, Tempelhofer Feld, Volkspark Friedrichshain, Treptower Park, Müggelsee shoreline. The bbox itself is permissive; the copy just reads as park-flavoured.
- **Started-at window**: 07:00–20:00 local, with a slight bias toward morning/evening ("walkies" times).
- **Copy templates**: a mix of serious-sounding audit language ("Grunewald north-loop patrol") and comic ("Bruno found three sticks today 🐕"). Bilingual EN + DE.

**Why narrower:** the persona is a feature, not a limitation. Not every dog-walk needs to be in a park, but pretending Bruno walked 40 km across Brandenburg would break the illusion the whole persona exists to prop up.

### Route generation: BRouter point-to-point in a seed region

**Decision:** A configured seed region is a bounding box. For the Bruno persona:

- Region: Berlin inner (`13.25,52.45,13.55,52.60`) — narrower than "Berlin + Brandenburg"; a dog-walk spanning Brandenburg breaks the illusion.
- Profile: `trekking` only (see the Bruno persona decision above).
- Start point: random within the box.
- End point: 2–12 km crow distance from start.
- Query BRouter with those two waypoints and `trekking`; reject and retry if BRouter returns no route or the computed distance is outside a sanity band (say, 1.5–18 km real distance).
- Persist the returned GPX as the route's source of truth and let existing enrichment compute the rest (PostGIS geom, distance, elevation).

The bbox stays env-configurable; changing `DEMO_BOT_REGION` relocates Bruno without a code change.

**Alternatives considered:**
- **Pre-recorded GPX files in a corpus.** Chosen by user to be (b) — synthesised via BRouter — in the conversation that led here. Keeps variety cheap and relocatable (change the bbox, new city).
- **Komoot import** — reject, external dependency.
- **Multi-waypoint (3+ stops)** — slight realism gain, much higher generation failure rate (more chances for BRouter to return no-route). Skip.

### Activity generation follows the route

**Decision:** When a route is generated, immediately derive an activity from it:

- `route_id` links to the new route
- `name` and `description` drawn from a small templated set (e.g., "Weekend ride through the Havelland", "Evening loop around Müggelsee")
- `started_at` = today between 06:00 and 20:00 local (random), `duration` = distance ÷ an average speed per profile ± jitter
- `distance`, `elevation_gain`, `elevation_loss` = the route's computed values
- `gpx` = the route's GPX verbatim (the activity "happened" along the planned route)
- `visibility = 'public'`, `synthetic = true`

**Why bundled:** keeping route + activity generation in one transaction means the feed item is coherent the moment it appears. Separating them just to pretend the user planned then rode feels like theatre — we're not hiding the bot, we're just filling the surface.

### Cadence and guards

**Decision:** A dog walks twice a day, sometimes three times, never six. The schedule should look like Bruno's day, not like a cron job.

- A recurring pg-boss job `demo-bot:generate` fires **every 90 minutes** as a singleton.
- Most ticks decide to *not* walk: the handler rolls a per-tick probability and skips if it doesn't hit. The probability is **0.12 per tick during 07:00–21:00 local, 0 otherwise** — which yields roughly 2–3 walks per day across the day, biased to waking hours.
- This both looks human (walks aren't on a fixed cron) and makes the generation load tiny: one BRouter call per walk, so ~2–3 per day.
- The job skips itself entirely when `process.env.DEMO_BOT_ENABLED !== "true"`. Dev / CI / tests: no-op.
- Hard cap: if there are already ≥ 40 synthetic items in the last 14 days (≈ 3/day × 14 rounded up), skip for that tick. Stops runaway growth if the retention job fails.
- BRouter call per generation: 1. Bot traffic is rounding-error compared to real user traffic.

**Alternatives considered:**
- **Fixed cron every 4 hours** — boring, too regular, a demo visitor with sharp eyes notices.
- **Poisson process with mean 3/day** — more faithful but more code. The 90-minute-tick-with-probability scheme is close enough.
- **Walk at specific realistic times** (morning, lunch, evening) — adds temporal pattern. Probably worth revisiting once we see the feed in practice, but not worth coding up front.

### Retention

**Decision:** A second recurring job `demo-bot:prune` runs daily and deletes synthetic routes + activities whose `created_at` is older than `DEMO_BOT_RETENTION_DAYS` (default 14). Route-version rows cascade-delete via existing FK.

**Why daily, not weekly:** smaller blast radius if the prune gets something wrong, and it keeps the feed visibly "recent" rather than stable.

### Flagging synthetic content at the DB level

**Decision:** Add `synthetic boolean NOT NULL DEFAULT false` to `journal.routes` and `journal.activities`. Set `true` only when the bot inserts.

**Why:** makes the "delete all bot content" operation a one-liner and lets future listing code exclude synthetic if we decide to, without introspecting content shape or owner. `owner_id = demo_user_id` would almost work as a proxy, but the dedicated flag decouples identity from status — if we later delete and re-seed the demo user we don't lose the signal.

### Env surface

**Decision:**
- `DEMO_BOT_ENABLED`: `"true"` turns the generator + prune on; anything else is off. Absent means off.
- `DEMO_BOT_RETENTION_DAYS`: integer, defaults to 14.
- `DEMO_BOT_REGION`: JSON `{ "bbox": [w,s,e,n] }`, defaults to inner Berlin (`13.25,52.45,13.55,52.60`) to suit Bruno's park-walker persona.
- No secrets. The whole feature is public-facing by design.

## Risks / Trade-offs

- **BRouter outages halt the feed** → acceptable; the job logs and skips. The feed will stop refreshing but existing items remain visible.
- **Uncanny repetition** (same start neighbourhoods, template names) → mitigated by varying the start point randomly and the templated copy, but still acceptable for a demo. A reviewer will obviously figure out it's synthetic if they look — we're not hiding it.
- **Mistaking bot content for real content during analytics** → mitigated by the `synthetic` flag; analytics queries filter `WHERE synthetic = false` when they want real usage.
- **Runaway insert if retention breaks** → mitigated by the hard cap (50 items in last 14 days) inside the generator.
- **GDPR / privacy concerns** → none new: the bot has no real PII, its content is first-party, and `demo@trails.cool` is a reserved sentinel address.
- **Someone logs in as `demo`** → the user has no credentials (no passkey, no magic-token). Email sentinel means a magic-link request can't succeed either (no inbox). Safe.
- **Accidentally enabled in dev** → mitigated by the explicit env opt-in; default-off in every environment but prod.

## Migration Plan

1. Merge schema + code; `drizzle-kit push --force` adds `synthetic` columns.
2. Set `DEMO_BOT_ENABLED=true` on the prod Journal container; leave every other environment off.
3. On next worker restart, the bootstrap step inserts the `demo` user.
4. First generation run produces one route + activity. Verify at `/users/demo`.
5. After a few ticks, verify the feed looks plausible and the prune doesn't fire unexpectedly (it won't, nothing is 14 days old).

**Rollback:** `DEMO_BOT_ENABLED=false` and redeploy. To wipe all generated content: `DELETE FROM journal.activities WHERE synthetic = true; DELETE FROM journal.routes WHERE synthetic = true;`. The `demo` user row can stay — it's cheap and keeps the URL stable if we re-enable later.

## Open Questions

- **Do we want the profile to also get a "synthetic content" badge** so honest readers (and us, on demos) can tell at a glance? A tiny "demo account" pill on `/users/demo` is cheap. Decide during implementation.
- **Should the bot post a few backfilled items on first enablement** so the feed isn't just one item for the first four hours? Probably yes — a small one-time bootstrap that generates 3–5 items immediately if the synthetic-item count is 0. Proposing it as a task.
- **Should BRouter calls be recorded as `brouter_request_duration_seconds` the same as user requests**? Probably — same histogram is fine; synthetic traffic is a small addition and it keeps ops alerts meaningful.
