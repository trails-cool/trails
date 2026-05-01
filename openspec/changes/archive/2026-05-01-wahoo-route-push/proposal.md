## Why

The existing Wahoo integration is read-only: we pull completed workouts back into the Journal as activities. Users who plan a route in trails.cool today still have to email themselves a GPX, open the Wahoo app, and import it manually before the route reaches their bike computer. Wahoo's Cloud API exposes `POST /v1/routes` (scope `routes_write`) — verified at <https://cloud-api.wahooligan.com/> — which lets us push a route directly so it appears on the user's ELEMNT/BOLT/ROAM. Closing this loop is the single biggest "why isn't this on my head unit?" friction we hear from cyclists testing the Planner.

## What Changes

- New "Send to Wahoo" action on the route detail page in the Journal, visible only to the owner when their Wahoo account is connected.
- New server-side route push pipeline: GPX → FIT Course binary → `POST https://api.wahooligan.com/v1/routes`.
- New shared package `@trails-cool/fit` that wraps a JS FIT encoder and exports `gpxToFitCourse(gpx: string): Uint8Array`. The Journal owns the API call; the package is provider-agnostic.
- New `routes_write` OAuth scope added to the Wahoo connect flow. Existing connected users will be prompted to re-authorize the first time they push a route (no silent scope upgrade).
- New `sync_pushes` table (mirrors `sync_imports`) so we can show "Sent to Wahoo at <time>" on the route detail page and avoid re-pushing identical content.
- Extend `SyncProvider` interface with an optional `pushRoute(connection, route)` method. Providers that don't support push (none today) leave it undefined; the UI hides the button.

## Capabilities

### New Capabilities
- `wahoo-route-push`: Push a Journal route to a connected Wahoo account so it syncs to the user's bike computer. Covers the UI affordance, GPX→FIT Course conversion, the `POST /v1/routes` call, idempotency via `sync_pushes`, and re-auth handling for the new scope.

### Modified Capabilities
- `wahoo-import`: The "Connect Wahoo" scenario currently lists scopes `workouts_read`, `user_read`, `offline_data`. It must also request `routes_write`, and existing connections without that scope must be re-prompted on first push.

## Impact

- **Code**:
  - `apps/journal/app/lib/sync/providers/wahoo.ts` — add `routes_write` scope, implement `pushRoute`, surface scope-mismatch errors.
  - `apps/journal/app/lib/sync/types.ts` — extend `SyncProvider` interface.
  - `apps/journal/app/routes/` — new `/api/sync/push/wahoo/:routeId` action; "Send to Wahoo" button on the route detail page.
  - `packages/db/src/schema/journal.ts` — new `sync_pushes` table + `granted_scopes` column on `sync_connections`, plus the generated Drizzle migration in `packages/db/migrations/`.
  - **New package** `packages/fit/` — GPX→FIT Course encoder, co-located tests with FIT-decoder round-trip fixtures.
- **Dependencies**: One new dep — `@garmin/fitsdk` (Garmin's official ESM-native FIT SDK; see design.md §1 for evaluation). `fit-file-parser` is already a dep on the import path and is reused as the round-trip oracle in tests.
- **External API**: Net-new outbound calls to `api.wahooligan.com/v1/routes`. No webhook changes.
- **Privacy manifest**: Update `docs/privacy.md` (or wherever the manifest lives) to declare that route geometry + name + description are sent to Wahoo when the user opts in by clicking "Send to Wahoo".
- **Out of scope for this change**: bulk push ("send all my routes"), automatic push on route save, push to non-Wahoo providers, and pushing route updates after the initial send (PUT /v1/routes/:id can come later — first send wins).
