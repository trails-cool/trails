## Why

Route and activity rows can currently be saved with `geom IS NULL` when the PostGIS geometry write fails after the row insert succeeds — the error is swallowed silently with a `console.error`. This means missing map thumbnails, broken route-push deduplication, and corrupted spatial queries with no signal to the user or operator. The Planner callback endpoint also accepts GPX from an external source with no validation before writing.

## What Changes

- **New `gpx-save.server.ts` module** owns GPX validation and atomic geometry persistence; `setGeomFromGpx` moves here and becomes internal.
- **`validateGpx(gpx)`** parses the GPX string, checks ≥2 track points and valid coordinate ranges, throws `GpxValidationError` on failure, and returns the parsed result so callers don't re-parse.
- **`createRoute`, `updateRoute`, `createActivity`, `createRouteFromActivity`** all wrap their DB writes (row insert/update + geom write + version snapshot) in `db.transaction()` — partial state (row exists, geom NULL) is no longer possible.
- **`setGeomFromGpx` stops swallowing errors** — it throws, causing the transaction to roll back.
- **`demo-bot.server.ts`** migrated from raw inserts + `setGeomFromGpx` to `createRoute` / `createActivity`, eliminating a bypass of the new invariant.
- **`activities.server.ts`** removes inline `parseGpxAsync` call; uses the `ParsedGpx` returned by `validateGpx` for stat extraction instead.
- **ADR recorded**: PostGIS geometry writes are always transactional with row writes.

## Capabilities

### New Capabilities

- `gpx-save`: Atomic GPX validation and PostGIS geometry persistence for routes and activities.

### Modified Capabilities

*(none — no user-visible requirement changes; this is an implementation-layer correctness fix)*

## Impact

- `apps/journal/app/lib/routes.server.ts` — `setGeomFromGpx` export removed; callers updated.
- `apps/journal/app/lib/activities.server.ts` — inline `parseGpxAsync` removed; imports from `gpx-save`.
- `apps/journal/app/lib/demo-bot.server.ts` — raw insert pattern replaced with `createRoute` / `createActivity`.
- `apps/journal/app/routes/api.routes.$id.callback.ts` — no validation changes needed (validation now inside `updateRoute`); GPX errors surface as thrown exceptions → callers return 400.
- `@trails-cool/gpx` — no changes; `parseGpxAsync` is still the underlying parser.
- No API surface changes, no schema changes, no migration required.
