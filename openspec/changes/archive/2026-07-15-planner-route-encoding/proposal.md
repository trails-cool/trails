## Why

The planner's Yjs session doc stores the computed route very inefficiently: a 4-waypoint / 77 km route already serializes to **~305 KB**. Three sources of bloat in `routeData` (`apps/planner/app/lib/route-data.ts`, `writeComputedRoute`):

1. **Geometry is stored twice** — `geojson` (a GeoJSON LineString of every coordinate) *and* `coordinates` (the same coordinates as a plain array), both `JSON.stringify`d.
2. **Coordinates are stringified JSON floats** — `[13.4051234,52.5204567]` ≈ 22 bytes/point.
3. **Seven per-coordinate road-metadata arrays** (`surfaces`, `highways`, `maxspeeds`, `smoothnesses`, `tracktypes`, `cycleways`, `bikeroutes`) stored as JSON `string[]` — in practice long runs of the same value.

This grows linearly with route length toward the 5 MB doc cap, bloats every reconnect's full-state sync, and was the underlying cause of the WS reconnect-loop outage (mitigated, not removed, by raising the frame cap in #587). It is pure encoding waste: the data is *derived*, and the routing-host model already computes it exactly once.

## What Changes

Encode the computed route compactly in `routeData`, **without changing the routing-host "compute once, share via Yjs" model** — one elected client still computes via BRouter and writes the result into the doc for everyone to read; clients never recompute.

- Store geometry **once** (single source of truth; derive the other representation at read time).
- Encode the polyline compactly (delta + varint / encoded-polyline) instead of stringified JSON floats.
- **Run-length-encode** the road-metadata arrays.
- Centralize encode/decode in `route-data.ts` so all readers are transparently unaffected.
- **Backward compatible**: the read path transparently handles both the existing JSON format (already persisted in `planner.sessions.yjs_state`) and the new encoding — no flag day, no migration downtime.

Target: **~5× smaller** (≈305 KB → ≈40–60 KB for that route). `MAX_DOC_BYTES = 5 MB` stays the guard; GPX export output stays byte-compatible.

## Capabilities

### New Capabilities
- `planner-route-encoding`: how the planner's computed route (geometry + road metadata) is compactly and backward-compatibly encoded in the Yjs session document, independent of how it is computed or shared.

### Modified Capabilities
<!-- None: the routing-host compute/share behavior and route-coloring semantics are unchanged; only the on-doc encoding changes. -->

## Impact

- `apps/planner/app/lib/route-data.ts` — `writeComputedRoute` / read helpers (`readComputedRoute`, `readRoadMetadata`, etc.): new encode on write, dual-format decode on read.
- Readers via those helpers, unchanged at the call site: `SessionView` map rendering, elevation profile, GPX export, save-to-journal, road-type/surface coloring.
- New encoding module + tests in `@trails-cool/planner` (or `@trails-cool/gpx`/`map-core` if the codec is reusable).
- No schema change (`yjs_state` is opaque bytea); no API change; no change to routing-host election or BRouter usage.
