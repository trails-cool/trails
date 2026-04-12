## Why

Map configuration is scattered across Planner components: tile URLs in `packages/map/src/layers.ts`, color palettes in `ColoredRoute.tsx`, POI categories in `poi-categories.ts`, z-index constants in `z-index.ts`, and overlay configs hardcoded in `PlannerMap.tsx`. This makes it impossible to share map definitions with a future mobile app (MapLibre) or migrate the web to a different renderer without duplicating everything.

## What Changes

- **New `packages/map-core/` package**: Renderer-agnostic map definitions — tile sources, overlay configs, route color palettes, POI category configs, z-index layering constants. Pure TypeScript data, no rendering code, no DOM dependencies.
- **Refactor `packages/map/`**: Import tile configs from `map-core` instead of defining its own
- **Refactor Planner components**: Import color palettes, POI categories, and z-index constants from `map-core` instead of defining them locally

## Capabilities

### New Capabilities
- `map-core`: Shared renderer-agnostic map definitions (tiles, colors, overlays, POI categories, z-index)

### Modified Capabilities
- `map-display`: Tile layer configs sourced from `map-core` instead of locally defined
- `route-coloring`: Color palettes and grade functions sourced from `map-core`
- `osm-poi-overlays`: POI category definitions sourced from `map-core`

## Impact

- New package: `packages/map-core/` added to pnpm workspace and Turborepo
- `packages/map/src/layers.ts` → thin re-export from `map-core`
- `apps/planner/app/components/ColoredRoute.tsx` → imports palettes from `map-core`
- `apps/planner/app/lib/poi-categories.ts` → moves to `map-core`
- `apps/planner/app/lib/z-index.ts` → moves to `map-core`
- No user-facing changes — pure refactor
