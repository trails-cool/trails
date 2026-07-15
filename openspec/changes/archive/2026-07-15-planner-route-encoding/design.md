## Context

`writeComputedRoute(doc, routeData, enriched)` in `apps/planner/app/lib/route-data.ts` writes, per computed route:
`geojson` (stringified GeoJSON LineString), `coordinates` (stringified `[lon,lat][]` — the same points again), `segmentBoundaries`, and the seven `ROAD_METADATA_KEYS` arrays (`surfaces`/`highways`/`maxspeeds`/`smoothnesses`/`tracktypes`/`cycleways`/`bikeroutes`, each a stringified `string[]`). Reads go through helpers in the same module (`readComputedRoute`, `readRoadMetadata`, `getProfile`). The routing host (elected via Yjs awareness) computes the route once and calls `writeComputedRoute`; all other participants only read. The doc is persisted opaquely as `planner.sessions.yjs_state` (bytea) and re-synced in full on every reconnect.

The size is dominated by geometry (stored twice, as JSON floats) and the metadata arrays (one entry per coordinate, JSON strings). None of it is user intent — it is a deterministic function of waypoints + profile + no-go areas.

## Goals / Non-Goals

**Goals:**
- ~5× smaller `routeData` (≈305 KB → ≈40–60 KB for a 77 km route), scaling far better with length.
- Zero change to the routing-host "compute once, write to doc, everyone reads" model.
- Backward compatible: old JSON-format docs already persisted must keep working with no migration step and no flag day.
- Readers unchanged at their call sites — decode is centralized in `route-data.ts`.
- GPX export output stays byte-identical.

**Non-Goals:**
- Changing routing-host election, BRouter usage, or making clients recompute.
- Removing the computed route from the doc (compute-once-and-share stays).
- Changing `MAX_DOC_BYTES` (5 MB) or route-coloring semantics.
- A lossy geometry simplification (Douglas–Peucker etc.) — separate concern; this change is lossless re-encoding.

## Decisions

### 1. Single geometry source, derived views
Store geometry once. Keep `coordinates` as the canonical `[lon,lat][]` and DROP the persisted `geojson`; rebuild the GeoJSON LineString at read time from coordinates (it is a trivial wrapper). Readers that want GeoJSON call a `readGeojson()` helper that assembles it from the decoded coordinates. Rationale: coordinates are the minimal representation; geojson is pure envelope.

### 2. Compact coordinate codec
Encode coordinates as **delta + zig-zag varint** over fixed-precision integers (lat/lon × 1e5 ≈ 1.1 m resolution, the BRouter/OSM working precision), base64'd into the Yjs string value — i.e. the Google encoded-polyline family. ~4–6 bytes/point vs ~22. Exposed as pure `encodePolyline(coords)` / `decodePolyline(str)`; property-tested for round-trip within the precision bound. Store a small `enc` version tag alongside so future codec changes stay detectable.

### 3. Run-length-encode metadata arrays
Each `ROAD_METADATA_KEYS` array becomes a list of `[value, runLength]` pairs (JSON or the same varint stream). Road attributes change rarely along a route, so RLE collapses thousands of entries to a handful. Decode expands back to the per-coordinate `string[]` the readers already expect.

### 4. Dual-format read path (backward compatibility)
The write path always emits the new encoding. The read path detects format per key: presence of the `enc` tag (or an encoded-value sentinel) → new decoder; otherwise fall back to the existing `JSON.parse`. So a session persisted before this change reads correctly, and it upgrades to the compact form the first time the host recomputes (which happens on the next edit). No migration job, no downtime. Old readers on an old client tab won't understand a new doc — acceptable because a planner session's participants load the same deployed build; a stale tab reconnects to the new build.

### 5. Codec location
Put the pure codec (`polyline.ts` + `rle.ts`, or one `route-codec.ts`) where it can be unit-tested without the DOM/Yjs — `@trails-cool/map-core` (framework-free, already server-safe) is the natural home; `route-data.ts` imports it. Keeps `route-data.ts` the single encode/decode boundary.

## Risks / Trade-offs

- [Precision loss from integer quantization] → 1e5 (~1.1 m) is below BRouter's own resolution and GPX's practical precision; round-trip tests assert the bound. Acceptable and lossless at the meaningful scale.
- [Dual-format read path adds branching] → Small, centralized in `route-data.ts`, and removable later once no old sessions remain (sessions are ephemeral/short-lived, so old-format docs age out quickly).
- [A very stale client tab holds an old-format doc while another writes new-format] → Same-session participants run the same deployed build; a reconnect after deploy picks up the new build. Worst case a stale tab can't decode and reloads — no data loss (doc is persisted server-side).
- [GPX export must stay byte-compatible] → Export builds from decoded coordinates, which round-trip within precision; a golden-file test guards the output.

## Migration Plan

Pure library + planner change; no DB migration (yjs_state is opaque). Deploys with the apps. Existing sessions read via the fallback and re-encode compactly on their next recompute. Rollback = revert; new-format docs written in the interim would then fail to decode on the reverted build, but sessions are ephemeral and re-encode on edit — acceptable, and can be de-risked by shipping the *reader* first if desired.

## Open Questions

- Ship dual-write (both formats) for one release to make rollback perfectly safe, or accept the ephemeral-session risk and go straight to new-write? Leaning new-write (simpler, and sessions are short-lived) unless the rollback window matters.
