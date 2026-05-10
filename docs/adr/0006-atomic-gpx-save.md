# ADR-0006: Atomic GPX Save via gpx-save Module

**Status:** Accepted  
**Date:** 2026-05-10

## Context

Routes and activities store GPX text in a `gpx` column and a derived PostGIS LineString in a `geom` column. Originally, the row insert and the `ST_GeomFromGeoJSON` update were separate statements issued outside any transaction. If the geometry write failed (e.g. PostGIS unavailable, malformed coordinates), the row would be committed with `geom IS NULL` and no error surfaced. This silent failure made the geom column unreliable and was invisible to callers.

Additionally, GPX validation (parse, minimum track points, coordinate range check) was either absent or scattered across callers, with some paths swallowing parse errors and continuing without geometry.

## Decision

1. **Single module owns geometry persistence.** `apps/journal/app/lib/gpx-save.server.ts` is the sole place that validates GPX and writes PostGIS geometry. No other module issues raw `UPDATE … SET geom = …` statements.

2. **`validateGpx(gpx) → Promise<GpxData>`** parses the GPX string, asserts ≥ 2 track points, and checks all coordinates are within valid ranges (lat −90..90, lon −180..180). It throws `GpxValidationError` on any failure. It returns the parsed result so callers don't re-parse for stat extraction.

3. **`writeGeom(tx, id, table, coords)`** accepts a Drizzle transaction client and writes the PostGIS geometry inside that transaction. It throws on failure — no try/catch anywhere in the call chain.

4. **Every save that includes GPX is wrapped in `db.transaction()`** covering: the row insert/update, the `writeGeom` call, and any version snapshot insert. A PostGIS failure rolls back the entire transaction — a row with `gpx IS NOT NULL` and `geom IS NULL` cannot be produced through the normal save path.

5. **Fail loudly everywhere.** The demo-bot and all callers surface errors rather than swallowing them. The demo-bot uses `createRoute` / `createActivity` rather than raw inserts.

## Consequences

- `GpxValidationError` surfaces to API callers. The Planner callback endpoint (`api.routes.$id.callback.ts`) catches it and returns 400 so the Planner receives a typed error.
- The `synthetic` flag is threaded through `RouteInput` and `ActivityInput` so the demo-bot can mark rows without bypassing the shared save functions.
- Any future module that needs to persist geometry **must** go through `gpx-save.server.ts`. Do not re-introduce inline `UPDATE … SET geom = …` statements elsewhere.
