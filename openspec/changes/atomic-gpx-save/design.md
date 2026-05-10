## Context

Every write of a GPX track in the Journal follows a two-step pattern: insert/update the row, then call `setGeomFromGpx` to write the PostGIS `geom` column via a raw `UPDATE`. The two steps are not in a transaction. `setGeomFromGpx` wraps its error in a `console.error` and returns, leaving the row with `geom IS NULL`. This affects `createRoute`, `updateRoute`, `createActivity`, `createRouteFromActivity`, and `demo-bot.server.ts` (which bypasses the save functions entirely with raw inserts).

`setGeomFromGpx` is currently exported from `routes.server.ts` and imported by `activities.server.ts` and `demo-bot.server.ts`, making it a de-facto shared utility that lives in the wrong module.

## Goals / Non-Goals

**Goals:**
- `geom IS NULL` on a row that has `gpx` set is impossible through the normal save path.
- GPX is validated (≥2 track points, valid coordinate ranges) before any DB write.
- All callers fail loudly on invalid or unpersistable GPX — no silent degradation.
- PostGIS write participates in the same `db.transaction()` as the row write and version snapshot.
- `setGeomFromGpx` is internal to the new `gpx-save.server.ts` module; no other file calls it.
- `demo-bot.server.ts` uses `createRoute` / `createActivity` and gets the invariant for free.

**Non-Goals:**
- No API surface changes.
- No DB schema changes or migrations.
- No changes to the `@trails-cool/gpx` parser.
- No changes to how the Planner callback endpoint validates its authorization (JWT stays as-is); validation of the GPX payload is now handled inside `updateRoute`.
- No changes to `getGeojson` / `getSimplifiedGeojsonBatch` — read paths are out of scope.
- No fix for the O(N) `getSimplifiedGeojsonBatch` query pattern (separate concern).

## Decisions

### 1. New module: `gpx-save.server.ts`

`setGeomFromGpx` belongs in neither `routes.server.ts` nor `activities.server.ts` — it is shared infrastructure. A dedicated `apps/journal/app/lib/gpx-save.server.ts` owns validation and geometry persistence. `routes.server.ts` and `activities.server.ts` both import from it.

Exports:
- `validateGpx(gpx: string): Promise<ParsedGpx>` — public
- `writeGeom(tx, id, table, coords): Promise<void>` — internal (not exported)
- `GpxValidationError` — public (callers catch it to return 400)

The existing `setGeomFromGpx` export from `routes.server.ts` is removed. Any file that currently imports it must migrate.

### 2. Validation inside save functions, not at call sites

`validateGpx` is called at the start of `createRoute`, `updateRoute`, `createActivity`, and `createRouteFromActivity` — before any transaction is opened. This means:

- Every caller gets validation for free, including the mobile API (`api.v1.routes`) and the Planner callback.
- The callback endpoint does not need its own validation logic; it catches `GpxValidationError` and returns 400.
- Future callers can't bypass validation by accident.

Alternative considered: validate only at the callback boundary. Rejected because it leaves mobile API and direct DB writes unprotected.

### 3. `db.transaction()` wrapping row write + geom write + version snapshot

Drizzle supports `db.transaction(async (tx) => { ... })`. The raw PostGIS `UPDATE` inside `writeGeom` receives `tx` as its first argument and executes within the same transaction. If `writeGeom` throws, Drizzle rolls back the entire transaction — the row insert is reversed.

```
db.transaction(async (tx) => {
  // 1. validateGpx already ran (before tx opened)
  await tx.insert(routes).values(...)       // or update
  await writeGeom(tx, id, "routes", coords) // throws → rollback
  await tx.insert(routeVersions).values(...)
})
```

The transaction is opened *after* `validateGpx` succeeds. This keeps the transaction as short as possible (no async GPX parsing inside a held transaction).

### 4. `activities.server.ts` stat extraction uses `validateGpx` result

Currently `createActivity` calls `parseGpxAsync` inline to extract `distance`, `elevationGain`, `elevationLoss`, `startedAt`. After this change, `validateGpx` returns the `ParsedGpx` object. `createActivity` uses that result directly — one parse, not two.

The activity-specific fields (`startedAt` from `gpxData.tracks[0][0].time`) are still extracted by `createActivity`; `validateGpx` returns the full parsed object so callers have access to everything.

### 5. `demo-bot.server.ts` migrates to `createRoute` / `createActivity`

The demo-bot currently does:
```ts
await db.insert(routes).values({ ... distance, elevationGain, ... })
await setGeomFromGpx(routeId, "routes", result.gpx)
await db.insert(activities).values({ ... })
await setGeomFromGpx(activityId, "activities", result.gpx)
```

After migration it calls `createRoute` and `createActivity`, which own all of this. The demo-bot passes pre-computed stats via `RouteInput` / `ActivityInput` (already supported: the input types accept optional `distance`, `elevationGain`, etc.). `createRoute` will prefer input stats over re-parsed stats when provided, avoiding redundant parsing for the demo-bot's case where BRouter already computed them.

Alternative considered: leave demo-bot as-is and just make `setGeomFromGpx` throw. Rejected because it keeps a second bypass path alive and requires demo-bot to handle its own transaction.

### 6. ADR recorded

ADR-0006 documents that PostGIS geometry writes are always transactional with row writes, so future code doesn't re-introduce the split pattern.

## Risks / Trade-offs

- **Transaction duration**: Opening a DB transaction and then doing a raw SQL UPDATE adds a short hold on the row. For typical GPX sizes this is negligible — `validateGpx` runs before the transaction opens, so the held time is just the two DB statements.
- **demo-bot stat re-computation**: `createRoute` will call `validateGpx` on GPX that the demo-bot already parsed. Minor redundancy; acceptable given demo-bot is not a hot path.
- **Existing NULL geom rows**: Rows already in production with `geom IS NULL` are not backfilled by this change. A separate data-repair script would be needed. Out of scope.
- **`GpxValidationError` surfaces to users**: Routes/activities that previously saved silently will now return errors. This is the intended behaviour (fail loudly), but any caller that didn't expect an exception from `updateRoute` must now handle `GpxValidationError`. All current call sites are audited in the tasks.

## Migration Plan

No DB migration required. The change is purely in application code. Deploy is a standard app rollout — no staged migration, no feature flag.

Existing rows with `geom IS NULL` remain as-is (pre-existing data debt). A follow-up query can identify and optionally repair them:
```sql
SELECT id FROM journal.routes WHERE gpx IS NOT NULL AND geom IS NULL;
```
