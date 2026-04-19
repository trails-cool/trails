## 1. Schema

- [x] 1.1 Add `synthetic boolean NOT NULL DEFAULT false` to `journal.routes` in `packages/db/src/schema/journal.ts`
- [x] 1.2 Add the same column to `journal.activities`
- [x] 1.3 Verify existing CRUD helpers (`createRoute`, `updateRoute`, `createActivity`, `listRoutes`, `listActivities`) compile and ignore the new column for default callers

## 2. Bruno bootstrap

- [x] 2.1 Reserved username: `bruno`. Sentinel email: `bruno@<DOMAIN>`. Display name: `Bruno`. Bio: a short whimsical line (finalise exact wording during apply — e.g. "Professional park inspector. Currently accepting tennis balls.").
- [x] 2.2 Add an `ensureDemoUser()` helper in `apps/journal/app/lib/demo-bot.server.ts` that inserts the `bruno` row only if missing (idempotent via `ON CONFLICT DO NOTHING` on `username`), with `terms_accepted_at` and `terms_version` populated.
- [x] 2.3 Call `ensureDemoUser()` from the worker startup sequence when `DEMO_BOT_ENABLED === "true"`.
- [x] 2.4 Confirm Bruno has no credentials row; the passkey and magic-link login paths both fail for his email (no mailbox exists for `bruno@<DOMAIN>`).

## 3. Region + generation helpers

- [x] 3.1 Add `loadRegion()` that reads `DEMO_BOT_REGION` JSON (with `bbox: [w,s,e,n]`) and falls back to the inner-Berlin default `[13.25, 52.45, 13.55, 52.60]`
- [x] 3.2 Add `pickEndpoints(bbox)` — random start + end, 2–12 km crow distance apart (dog-walk scale)
- [x] 3.3 Profile is fixed to `trekking` (Bruno doesn't ride bikes); no `pickProfile()` needed for v1
- [x] 3.4 Add `templateName(startedAt)` + `templateDescription()` — EN + DE Bruno-voiced copy, mixing serious-audit flavour ("Grunewald north-loop patrol") and comic ("Bruno found three sticks today 🐕"); 10–15 entries in each pool, picked deterministically from the day + started-at to avoid same-day repeats

## 4. BRouter client for the bot

- [x] 4.1 Reuse the existing `computeRoute` helper where possible; otherwise add a minimal `brouter-client.server.ts` that POSTs to `process.env.BROUTER_URL` and returns parsed GPX + stats
- [x] 4.2 On no-route / 5xx / timeout, return a typed "no route" error — the job handles it, does not throw out of the worker

## 5. Generation job

- [x] 5.1 Register a pg-boss recurring job `demo-bot:generate` to fire every 90 minutes, singleton mode
- [x] 5.2 Handler: skip immediately if `DEMO_BOT_ENABLED !== "true"`
- [x] 5.3 Decide-to-walk gate: compute local hour; if outside 07:00–21:00 → skip. Otherwise roll a Bernoulli with p=0.12 and skip if it doesn't fire. Expected output: ~2–3 walks/day
- [x] 5.4 Hard cap: `SELECT count(*) FROM routes WHERE synthetic AND created_at > now() - interval '14 days'`; skip if >= 40
- [x] 5.5 Pick region + endpoints (profile is fixed to `trekking`); call BRouter; on failure log and return
- [x] 5.6 Insert route with `visibility='public'`, `synthetic=true`, owner = Bruno; insert linked activity with derived `started_at` = now, `duration` = distance ÷ ~4.5 km/h ± jitter, stats, and the same GPX

## 6. Initial backfill

- [x] 6.1 At the top of the generation handler, check if `count(synthetic routes) == 0`; if so, loop up to 5 times running the full generation body sequentially (each call independent — if one fails, keep going)
- [x] 6.2 After the backfill path, fall through to the normal single-item generation

## 7. Retention job

- [x] 7.1 Register a pg-boss recurring job `demo-bot:prune` with a cron like `15 3 * * *` (daily at 03:15 UTC), singleton
- [x] 7.2 Handler: skip if `DEMO_BOT_ENABLED !== "true"`
- [x] 7.3 Read `DEMO_BOT_RETENTION_DAYS` with default 14
- [x] 7.4 `DELETE FROM journal.activities WHERE synthetic AND created_at < now() - interval ?`; same for routes
- [x] 7.5 Log the count removed for observability

## 8. Ops + env surface

- [x] 8.1 Document `DEMO_BOT_ENABLED`, `DEMO_BOT_RETENTION_DAYS`, `DEMO_BOT_REGION` in `infrastructure/.env.example` + pass-through in `docker-compose.yml` (commented; not enabled in any environment file)
- [x] 8.2 Set `DEMO_BOT_ENABLED=true` only in prod (runtime flag — not set anywhere in-repo)
- [x] 8.3 Expose counts via Prometheus gauges `demo_bot_synthetic_routes_total` and `demo_bot_synthetic_activities_total`; refreshed from the job handlers so scrapes see live values

## 9. UX tweaks

- [x] 9.1 "🐕 demo account" badge on `/users/bruno` so honest readers can tell at a glance; gate on `user.username === 'bruno'`
- [x] 9.2 i18n: `demo.badge` key in EN + DE (e.g. "Demo account" / "Demo-Konto")

## 10. Tests

- [x] 10.1 Unit: `ensureDemoUser` is idempotent; second call is a no-op and does not duplicate (in `demo-bot.integration.test.ts`, runs under `DEMO_BOT_INTEGRATION=1`)
- [x] 10.2 Unit: `pickEndpoints` stays within bbox; distance bands match profile
- [x] 10.3 Unit: `templateName` / `templateDescription` return non-empty strings in both locales
- [x] 10.4 Integration (tests DB): the generation handler inserts one route + one activity with `synthetic=true, visibility='public'` when enabled, and inserts nothing when disabled
- [x] 10.5 Integration: the prune handler deletes only `synthetic=true` rows past the window; real rows are untouched
- [x] 10.6 E2E: `/users/bruno` renders the demo badge and lists public synthetic content to anonymous visitors (covers the user-visible surface)

## 11. Rollout

- [x] 11.1 Merge schema + code; deploy — the bot stays disabled everywhere because no env flag is set
- [ ] 11.2 Flip `DEMO_BOT_ENABLED=true` on prod via the SOPS env file + redeploy
- [ ] 11.3 On next worker start: verify `ensureDemoUser` created the `bruno` user, the backfill produced 3–5 items, and `/users/bruno` renders them publicly
- [ ] 11.4 After 24 h: verify cadence looks right and the prune job ran without deleting anything yet
