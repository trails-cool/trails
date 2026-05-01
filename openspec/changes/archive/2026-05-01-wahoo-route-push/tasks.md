## 1. FIT Course encoder package

- [x] 1.1 Scaffold `packages/fit/` (package.json, tsconfig, vitest config) following the pattern of `packages/gpx/`
- [x] 1.2 Add the package to `pnpm-workspace.yaml` and reference it from `apps/journal/package.json`
- [x] 1.3 Add `@garmin/fitsdk` dependency to `packages/fit/package.json` and a small ambient `src/fitsdk.d.ts` declaring the `Encoder`, `Stream`, and `Profile.MesgNum` shapes we use (the SDK ships no types)
- [x] 1.4 Wrap the SDK Encoder to emit the Course message stream Wahoo needs: `file_id` (type=course), `file_creator`, `course` (name, sport, capabilities), `lap` (start/end position, distance, elapsed time = 0), `event` (timer start at first record, timer stop at last), and `record` (position_lat, position_long, altitude, distance)
- [x] 1.5 Implement `gpxToFitCourse({ gpx, name, description?, sport? })`: parse GPX via `@trails-cool/gpx`, compute distance and ascent, drive the SDK encoder, return `Uint8Array`
- [x] 1.6 Add fixtures in `packages/fit/__fixtures__/` covering: short flat route, alpine route with elevation, multi-day route, route with single track point (should still encode), zero-track-point route (should throw)
- [x] 1.7 Write round-trip tests: encode each fixture, decode with `fit-file-parser`, assert track-point count and lat/lon/elevation parity within tolerance (1e-5 deg, 0.5 m)
- [x] 1.8 Add the package to `pnpm test` and `pnpm typecheck` runs (should be automatic via Turborepo)

## 2. Database schema for push tracking

- [x] 2.1 Add `sync_pushes` table to `packages/db/src/schema/journal.ts` with columns from design.md §3 and a unique index on `(user_id, route_id, route_version, provider)`
- [x] 2.2 Add a `granted_scopes text[]` column to `sync_connections` in the same schema file, defaulting to an empty array. (Backfill happens at `exchangeCode` time in slice 3 — pre-existing connections will be recognized as scope-mismatched on first push and trigger re-auth, which is the intended UX.)
- [x] 2.3 ~~Generate Drizzle migration files~~ — N/A: this repo runs `drizzle-kit push --force` schema-first, no checked-in `migrations/` directory. The schema edit is the migration source.
- [ ] 2.4 Apply locally via `pnpm db:push` against a running dev Postgres and verify with `pnpm db:studio` — deferred: requires `pnpm dev:services` (Docker) which isn't running in this workspace. CI applies on deploy.

## 3. Wahoo provider scope upgrade

- [x] 3.1 Add `routes_write` to the Wahoo scopes array in `apps/journal/app/lib/sync/providers/wahoo.ts:14`
- [x] 3.2 Persist `granted_scopes` on the `sync_connections` row at `exchangeCode` time. Wahoo's token endpoint does not return a `scope` field and grants scopes all-or-nothing, so record the requested scope set as granted. The scope-mismatch detection in §5.2 is therefore a comparison against our own constant, not against provider-reported state — that's intentional and only needs to flag pre-`routes_write` connections.
- [x] 3.3 Implement `pushRoute(connection, { gpx, name, description, externalId })` on the Wahoo provider: base64-encode the FIT, build the form-encoded body, POST `/v1/routes`, return `{ remoteId }` on success or throw a typed error on failure (token expired, scope missing, validation error, rate limit, generic)
- [x] 3.4 Wire token-refresh-on-401 through the new push call. Implemented at the boundary instead of inside `pushRoute`: the provider throws `PushError({ code: "token_expired" })` on 401 and the slice-4 action route catches it, calls `provider.refreshToken`, persists, and retries once. (No `withFreshToken` helper exists in this repo today; the existing webhook handler does the same inline.)

## 4. Sync provider interface extension

- [x] 4.1 Add an optional `pushRoute?: (connection, payload) => Promise<{ remoteId: string }>` method to the `SyncProvider` interface in `apps/journal/app/lib/sync/types.ts`
- [x] 4.2 Define the `PushRoutePayload` and `PushRouteResult` types alongside it
- [x] 4.3 Add a `providerSupportsPush(provider)` helper for use in loaders/UI

## 5. Push action route and idempotency layer

- [x] 5.1 Add an action route at `/api/sync/push/wahoo/:routeId` that resolves the route, verifies the requesting user is the owner, looks up the user's Wahoo connection, and runs the push
- [x] 5.2 Before calling Wahoo, check `sync_connections.granted_scopes` for `routes_write`; if missing, redirect to `getAuthUrl` with state `{ return_to, push_after }`
- [x] 5.3 Look up an existing `sync_pushes` row for `(user_id, route_id, route_version, 'wahoo')` — if `pushed_at` is set, return the existing `remote_id` without calling Wahoo
- [x] 5.4 On a fresh push, build the payload (`external_id = "route:<routeId>:v<version>"`, current timestamp, route name/description, start lat/lng, computed distance and ascent), call `provider.pushRoute`, and write the result to `sync_pushes` (insert on success, update existing row on retry of a failed attempt)
- [x] 5.5 Map error types to user-facing copy: scope missing → re-auth redirect; token expired after refresh → reconnect prompt; 422 validation → "We couldn't send this route — try editing the name or description"; 5xx / network → generic retry

## 6. OAuth callback resumes pending push

- [x] 6.1 Extend the OAuth callback handler at `/api/sync/callback/wahoo` to parse `state.push_after` and `state.return_to`
- [x] 6.2 If `push_after`, after persisting the new tokens and scopes, run the push pipeline server-side and redirect to `return_to` with a success or failure flash message
- [x] 6.3 If the user denied the new scope (callback arrives with `?error=access_denied`), redirect to `return_to` with the "needs route permission" notice

## 7. Route detail page UI

- [x] 7.1 In the route detail loader, include the latest `sync_pushes` row for the current version and the user's Wahoo connection presence + scopes
- [x] 7.2 Render the "Send to Wahoo" button next to the existing Export GPX action when conditions in spec §1 are met
- [x] 7.3 Render the post-push status: "Sent to Wahoo on <date>" replacing the button when a successful push exists
- [x] 7.4 Render the failed-push state: "Last attempt failed: <short error>" with the button still active
- [x] 7.5 Add the button copy "This sends your route to Wahoo" as a tooltip or helper text near the button (privacy disclosure at the action point)
- [x] 7.6 Add i18n strings for all new UI copy (English + German) per the i18n convention in CLAUDE.md

## 8. Privacy manifest

- [x] 8.1 Privacy disclosure added to `apps/journal/app/routes/legal.privacy.tsx` (the live in-app /legal/privacy page — this repo doesn't have a separate `docs/privacy.md` manifest). The new bullet describes that route geometry, name, and description are transmitted to Wahoo on opt-in.
- [x] 8.2 Cross-linked: proposal.md already references the privacy disclosure, and `legal.privacy.tsx` is the canonical disclosure surface.

## 9. Tests

- [x] 9.1 Unit tests for `gpxToFitCourse` — already covered in §1.7
- [x] 9.2 Unit tests for the action route's idempotency logic (mock Wahoo HTTP layer): fresh push, re-push of pushed version, retry of failed push, push of new version after edit
- [x] 9.3 Unit tests for the scope-mismatch redirect flow
- [ ] 9.4 E2E test for the success path — deferred. Needs new infra: a Wahoo HTTP mock alongside the dev server (intercepting `api.wahooligan.com/v1/routes` server-side, not via Playwright `page.route`). The unit-test layer in slice 4 already covers the pipeline against a mocked provider; promoting these to full-stack E2E should land with a shared `wahoo-mock.ts` fixture once we have a second push provider or a real-API smoke harness.
- [ ] 9.5 E2E test for the re-auth flow — deferred for the same reason as 9.4.

## 10. Manual verification before merge

- [ ] 10.1 Smoke test against Wahoo's real API in a dev sandbox: push a real route, confirm it appears in the Wahoo App and on a physical ELEMNT/BOLT/ROAM
- [ ] 10.2 Verify `provider_updated_at` and `external_id` semantics: push v1, edit and push v2, confirm both appear as separate routes on Wahoo
- [ ] 10.3 Verify error path: revoke `routes_write` from the dev account in Wahoo's UI, click Send to Wahoo, confirm the re-auth flow runs and completes the push
- [ ] 10.4 Verify the privacy manifest entry is reachable from the in-app privacy disclosure

## 11. Release

- [ ] 11.1 Run `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e`
- [ ] 11.2 Open PR with the change summary linking to `openspec/changes/wahoo-route-push/proposal.md`
- [ ] 11.3 After merge, monitor `sync_pushes.error` for the first week; if a recurring failure mode shows up, file a follow-up
- [ ] 11.4 Run `/opsx:archive wahoo-route-push` once the change is live and confirmed
