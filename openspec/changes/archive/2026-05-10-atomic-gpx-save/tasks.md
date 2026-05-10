## 1. New gpx-save module

- [x] 1.1 Create `apps/journal/app/lib/gpx-save.server.ts` with `GpxValidationError` class and `validateGpx(gpx: string): Promise<ParsedGpx>` — parses, checks ≥2 track points, checks coordinate ranges, throws on failure, returns parsed result
- [x] 1.2 Move `setGeomFromGpx` logic into `gpx-save.server.ts` as an internal `writeGeom(tx, id, table, coords)` function that accepts a Drizzle transaction client and throws on failure (no try/catch)
- [x] 1.3 Write unit tests in `gpx-save.server.test.ts` covering: valid GPX passes, <2 track points throws, out-of-range coordinates throw, unparseable GPX throws

## 2. Migrate routes.server.ts

- [x] 2.1 Import `validateGpx` and `writeGeom` from `gpx-save.server.ts`; remove local `setGeomFromGpx` implementation and its export
- [x] 2.2 Wrap `createRoute` in `db.transaction()`: validate GPX → insert row → `writeGeom` → insert `routeVersions`, all within the transaction client
- [x] 2.3 Wrap `updateRoute` in `db.transaction()`: validate GPX → update row → `writeGeom` → insert new `routeVersions`, all within the transaction client
- [x] 2.4 Verify `computeRouteStats` is called with the `ParsedGpx` returned by `validateGpx` (avoid re-parsing)

## 3. Migrate activities.server.ts

- [x] 3.1 Replace inline `parseGpxAsync` call in `createActivity` with `validateGpx`; extract stats from the returned `ParsedGpx`
- [x] 3.2 Wrap `createActivity` in `db.transaction()`: validate GPX → insert row → `writeGeom`, all within the transaction client
- [x] 3.3 Wrap `createRouteFromActivity` in `db.transaction()`: insert route row → `writeGeom` → update activity's `routeId`, all within the transaction client
- [x] 3.4 Remove `import { setGeomFromGpx } from "./routes.server.ts"` — no longer needed

## 4. Migrate demo-bot.server.ts

- [x] 4.1 Replace the raw `db.insert(routes).values(...)` + `setGeomFromGpx(routeId, ...)` block with a `createRoute(ownerId, input)` call; pass pre-computed stats via `RouteInput` fields so `createRoute` doesn't re-parse BRouter's output
- [x] 4.2 Replace the raw `db.insert(activities).values(...)` + `setGeomFromGpx(activityId, ...)` block with a `createActivity(ownerId, input)` call
- [x] 4.3 Remove `import { setGeomFromGpx } from "./routes.server.ts"` from `demo-bot.server.ts`

## 5. Callback endpoint error handling

- [x] 5.1 In `api.routes.$id.callback.ts`, catch `GpxValidationError` from `updateRoute` and return a 400 response with the validation message (currently the catch block returns 401 for all errors — narrow it)

## 6. ADR

- [x] 6.1 Write `docs/adr/0006-atomic-gpx-save.md` documenting that PostGIS geometry writes are always transactional with row writes and that `gpx-save.server.ts` is the sole owner of geometry persistence

## 7. Verification

- [x] 7.1 Run `pnpm typecheck` — no new type errors
- [x] 7.2 Run `pnpm test` — all existing tests pass; new `gpx-save.server.test.ts` tests pass
- [x] 7.3 Confirm `setGeomFromGpx` is no longer exported from any file (`grep -r "setGeomFromGpx" apps/journal/app` returns no results outside `gpx-save.server.ts`)
