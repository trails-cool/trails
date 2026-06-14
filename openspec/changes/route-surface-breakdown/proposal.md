## Why

"How much of this is gravel?" is a top-three question for anyone choosing a
route — Komoot's surface/waytype breakdown bars are one of its most-used
features, and `@trails-cool/map-core` already ships the surface/highway colour
palettes. We also already *compute* accurate per-segment surface and highway
tags from BRouter while planning (`route-merge` → `EnrichedRoute.surfaces[]`),
then **throw them away on save**. This change captures that data and shows it.

## What Changes

- On **route detail**, show surface and waytype **proportion bars** (e.g.
  "62% asphalt · 28% gravel · 10% path"), coloured with the `map-core`
  `SURFACE_COLORS` / `HIGHWAY_COLORS` palettes, with per-segment km/percent.
- **Persist the breakdown for Planner-created routes**: compute a
  distance-weighted surface + waytype distribution from the BRouter waytags at
  save time, send it in the planner→journal handoff, and store it on the route.
- Degrade gracefully: routes without breakdown data (older routes, or activities
  / manually-imported GPX that never had waytags) simply don't show the bars.

## Capabilities

### New Capabilities

- `route-surface-breakdown`: the surface/waytype proportion bars on route
  detail, how the distribution is derived from BRouter waytags, persisted at
  save, and rendered.

### Modified Capabilities

<!-- `planner-journal-handoff` gains one optional field in its save payload;
     noted in design, but the breakdown is a new capability, not a change to the
     handoff's existing requirements. -->

## Impact

- **Schema**: a nullable `surface_breakdown` jsonb column on `journal.routes`
  (additive — `pnpm db:push`, no data migration).
- **Planner**: `api.save-to-journal` computes the distance-weighted breakdown
  from the session `EnrichedRoute` (surfaces/highways + coordinates) and adds it
  to the POST body.
- **Journal**: the route callback (`api.routes.$id.callback`) accepts + stores
  it; the route detail loader exposes it; a `SurfaceBreakdown` component renders
  the bars (reusing `map-core` palettes + `stats.ts` distance formatting).
- **No new external dependency** — BRouter already returns the tags; no Overpass
  call. Imported activities/uploads are out of scope for v1 (see design).
