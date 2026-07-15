## 1. Codec primitives

- [x] 1.1 Add a framework-free codec in `@trails-cool/map-core` (e.g. `route-codec.ts`): `encodePolyline(coords: [lon,lat][]) -> string` / `decodePolyline(str) -> [lon,lat][]` using fixed-precision (1e5) delta + zig-zag varint + base64, with a version tag
- [x] 1.2 Add `encodeRuns(values: string[]) -> string` / `decodeRuns(str, length?) -> string[]` run-length codec for the road-metadata channels
- [x] 1.3 Unit tests: polyline round-trip within ~1 m over random + real fixtures; empty/single-point; RLE round-trip incl. all-same, all-distinct, and a realistic run pattern

## 2. Write path (new encoding)

- [x] 2.1 In `route-data.ts` `writeComputedRoute`: store geometry once as `encodePolyline(coordinates)` (drop the separate `geojson` write); write each `ROAD_METADATA_KEYS` channel via `encodeRuns`; keep `segmentBoundaries` + profile
- [x] 2.2 Add a `readGeojson(routeData)` helper that assembles the GeoJSON LineString from decoded coordinates (so callers that needed `geojson` no longer read a stored copy)

## 3. Read path (dual-format, backward compatible)

- [x] 3.1 In `route-data.ts` read helpers (`readComputedRoute`, `readRoadMetadata`, coordinate accessors): detect format per key (encoding version tag/sentinel → new decoder; else `JSON.parse` legacy) and return the same decoded shapes as today
- [x] 3.2 Point every reader (SessionView map render, elevation profile, GPX export, save-to-journal, road-type/surface coloring) at the helpers; confirm none reads a raw `routeData.get("geojson"|"coordinates"|<metadata>)` directly
- [x] 3.3 Tests: a legacy-format `routeData` decodes correctly through the helpers; a new-format one decodes correctly; both yield identical reader-facing data

## 4. Verification

- [x] 4.1 GPX-export golden test: export the same route via legacy and new encoding → byte-identical output
- [x] 4.2 Size assertion on a realistic route fixture (e.g. the ~77 km / multi-waypoint case): new-encoded `Y.encodeStateAsUpdate` size is ≥~4× smaller than legacy and a small fraction of `MAX_DOC_BYTES`
- [x] 4.3 Confirm routing-host election / BRouter usage unchanged (no client recompute); `pnpm --filter @trails-cool/planner --filter @trails-cool/map-core typecheck && lint && test`, full `pnpm test`
- [x] 4.4 Encode/decode + legacy-read + size covered by unit tests (route-codec, route-data); render/colors/export paths read through the same helpers and compile; live browser sanity rides the e2e suite (autonomous run)
