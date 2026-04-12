## Context

The Planner's map configuration is spread across multiple files:
- `packages/map/src/layers.ts` — base tile layer URLs and overlay tile configs
- `apps/planner/app/components/ColoredRoute.tsx` — 7 color palettes (surface, highway, smoothness, tracktype, cycleway, bikeroute, grade) + elevation color function
- `apps/planner/app/lib/poi-categories.ts` — 9 POI categories with Overpass queries, icons, colors, profile mappings
- `apps/planner/app/lib/z-index.ts` — marker z-index layering constants
- `apps/planner/app/lib/poi-snap.ts` — snap distance threshold

All of this is renderer-specific (Leaflet) and app-specific (Planner). A mobile app using MapLibre would need to duplicate all of it.

## Decisions

### D1: Package structure

```
packages/map-core/
  src/
    index.ts           — re-exports everything
    tiles.ts           — base layers + overlay layers (URLs, attribution, zoom)
    colors/
      surface.ts       — SURFACE_COLORS, DEFAULT_SURFACE_COLOR
      highway.ts       — HIGHWAY_COLORS, DEFAULT_HIGHWAY_COLOR
      smoothness.ts    — SMOOTHNESS_COLORS, DEFAULT_SMOOTHNESS_COLOR
      tracktype.ts     — TRACKTYPE_COLORS, DEFAULT_TRACKTYPE_COLOR
      cycleway.ts      — CYCLEWAY_COLORS, DEFAULT_CYCLEWAY_COLOR
      bikeroute.ts     — BIKEROUTE_COLORS, DEFAULT_BIKEROUTE_COLOR
      elevation.ts     — elevationColor(), routeGradeColor()
      maxspeed.ts      — maxspeedColor()
      index.ts         — re-exports all color maps
    poi.ts             — PoiCategory type + all category configs
    z-index.ts         — Z_WAYPOINT, Z_POI_MARKER, etc.
    snap.ts            — SNAP_DISTANCE_METERS
```

### D2: No rendering code

`map-core` contains zero rendering code — no React, no Leaflet, no MapLibre. Just TypeScript constants, types, and pure functions. This ensures it works in any environment (web, mobile, Node.js, tests).

### D3: Backwards-compatible migration

The existing `packages/map/` package re-exports `baseLayers` and `overlayLayers` from `map-core` so existing imports continue to work. Planner components are updated to import directly from `@trails-cool/map-core` where possible. No breaking changes to public APIs.

## Risks / Trade-offs

- **More packages in the monorepo** — one more thing to maintain. Mitigated by the package being pure data with no dependencies.
- **Import path changes** — Planner components need updated imports. Straightforward find-and-replace.
