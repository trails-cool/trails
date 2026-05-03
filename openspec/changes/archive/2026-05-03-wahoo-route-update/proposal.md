## Why

When a user pushes a route to Wahoo, edits the route, and pushes again, today we POST a brand-new route to `/v1/routes`. Wahoo treats it as unrelated to the first push (it does not de-duplicate by `external_id`), so the user's Wahoo route library accumulates one entry per version. The user expects "edit and re-send" to *update* the route they already saved on Wahoo, not pile new copies on top.

## What Changes

- When the Journal pushes a route version and a previous version of the same route was already successfully pushed to Wahoo, the Journal SHALL `PUT /v1/routes/:id` against the previously stored `remote_id` instead of posting a new route.
- Change the `external_id` sent to Wahoo from per-version (`route:<routeId>:v<version>`) to per-route (`route:<routeId>`). The version is still tracked locally for idempotency and "what's currently on Wahoo" display, but `external_id` should identify the logical route.
- Restructure `sync_pushes` semantics so a single logical Wahoo route maps to one row per `(user_id, route_id, provider)` whose `last_pushed_version` and `pushed_at` reflect the latest successful push, instead of one row per `(user_id, route_id, route_version, provider)`.
- The "Already on Wahoo" UI now shows the version Wahoo currently has, with a "Send updated version" CTA when the local route is newer.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `wahoo-route-push`: push pipeline switches from POST-per-version to POST-then-PUT, idempotency key narrows from version-scoped to route-scoped, and the `external_id` format changes.

## Impact

- **Code**: `apps/journal/app/lib/sync/providers/wahoo.ts` (add update path); `apps/journal/app/lib/sync/pushes.server.ts` (decide POST vs PUT based on existing `sync_pushes` row); `apps/journal/app/routes/api.sync.push.$provider.$routeId.ts` (no change in surface, internals only); `sync_pushes` table schema (drop `route_version` from the unique key, add `last_pushed_version` column).
- **Data migration**: existing `sync_pushes` rows are per-version; we collapse them so the highest-versioned row per `(user, route, provider)` becomes the canonical row and lower-versioned rows are deleted.
- **No changes** to authentication, scope set, or the Wahoo data URI / FIT capabilities work shipped in the cutover prep.
