## Why

"How much of this is gravel?" is a top-three question for choosing a route, and
Komoot's surface/waytype bars are one of its most-used features.
`@trails-cool/map-core` already ships the surface/highway colour palettes, and
the Planner already *computes* accurate per-segment surface/highway from BRouter
(`route-merge` → `EnrichedRoute.surfaces[]`) — then **discards it on save**.
This change captures that data, shows it as proportion bars, and **backfills
everything else** (imports, uploads, older rows) asynchronously so the bars
aren't limited to Planner routes.

## What Changes

- On **route and activity detail**, show surface and waytype **proportion bars**
  (e.g. "62% asphalt · 28% gravel · 10% path"), coloured with the `map-core`
  `SURFACE_COLORS` / `HIGHWAY_COLORS` palettes, with per-category km/percent.
- **Path 1 — synchronous (Planner routes):** compute a distance-weighted
  surface + waytype distribution from the BRouter waytags at save time, send it
  in the planner→journal handoff, store it. Accurate, free, no external call.
- **Path 2 — async backfill (everything else):** for a route/activity that has
  geometry but no breakdown (imports, manual uploads, pre-existing rows), a
  background job map-matches the geometry to OSM ways via Overpass, computes the
  breakdown, stores it, and **pushes an SSE event** so an open detail page fills
  the bars in live.
- Degrade gracefully: no geometry / not-yet-backfilled → no bars (or a
  "computing…" state while a backfill is in flight).

## Capabilities

### New Capabilities

- `route-surface-breakdown`: the surface/waytype proportion bars on route &
  activity detail — derived synchronously from BRouter waytags (Planner) or
  asynchronously via an Overpass backfill job with an SSE live-update.

### Modified Capabilities

<!-- `planner-journal-handoff` gains one optional payload field; `background-jobs`
     and `sse-broker` gain a new job + event, but those are additive uses of
     existing transports, owned by this new capability. -->

## Impact

- **Schema**: nullable `surface_breakdown` jsonb on `journal.routes` **and**
  `journal.activities` (additive — `pnpm db:push`).
- **Planner**: `api.save-to-journal` computes + sends the breakdown.
- **Journal**:
  - route callback stores the synchronous breakdown;
  - a typed `surface-backfill` pg-boss job (Overpass map-match → breakdown →
    store → SSE), enqueued after imports/uploads and available as a sweep;
  - a journal-side Overpass way/surface client (reusing the existing
    `/api/overpass` proxy pattern);
  - an SSE `surface_breakdown` event + a detail-page subscription;
  - a `SurfaceBreakdown` component (reuses `map-core` palettes + `stats.ts`).
- **i18n**: `journal.surface.*` (en + de).
- **Privacy**: the backfill sends route geometry to Overpass — see design for
  the proxy/self-host + visibility considerations.
