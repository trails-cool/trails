## 1. Package Setup

- [x] 1.1 Create `packages/map-core/` with `package.json`, `tsconfig.json`, add to pnpm workspace and Turborepo pipeline
- [x] 1.2 Create `src/index.ts` with re-exports for all modules

## 2. Tile Definitions

- [x] 2.1 Move `baseLayers` and `TileLayerConfig` from `packages/map/src/layers.ts` to `packages/map-core/src/tiles.ts`
- [x] 2.2 Move `overlayLayers` and `OverlayLayerConfig` to `packages/map-core/src/tiles.ts`
- [x] 2.3 Update `packages/map/src/layers.ts` to re-export from `@trails-cool/map-core`
- [x] 2.4 Update `packages/map/src/index.ts` exports

## 3. Color Palettes

- [x] 3.1 Extract `SURFACE_COLORS`, `DEFAULT_SURFACE_COLOR` from `ColoredRoute.tsx` to `map-core/src/colors/surface.ts`
- [x] 3.2 Extract `HIGHWAY_COLORS`, `DEFAULT_HIGHWAY_COLOR` to `map-core/src/colors/highway.ts`
- [x] 3.3 Extract `SMOOTHNESS_COLORS`, `DEFAULT_SMOOTHNESS_COLOR` to `map-core/src/colors/smoothness.ts`
- [x] 3.4 Extract `TRACKTYPE_COLORS`, `DEFAULT_TRACKTYPE_COLOR` to `map-core/src/colors/tracktype.ts`
- [x] 3.5 Extract `CYCLEWAY_COLORS`, `DEFAULT_CYCLEWAY_COLOR` to `map-core/src/colors/cycleway.ts`
- [x] 3.6 Extract `BIKEROUTE_COLORS`, `DEFAULT_BIKEROUTE_COLOR` to `map-core/src/colors/bikeroute.ts`
- [x] 3.7 Extract `elevationColor()`, `routeGradeColor()` to `map-core/src/colors/elevation.ts`
- [x] 3.8 Extract `maxspeedColor()` to `map-core/src/colors/maxspeed.ts`
- [x] 3.9 Create `map-core/src/colors/index.ts` re-exporting all color maps and functions
- [x] 3.10 Update `ColoredRoute.tsx` to import from `@trails-cool/map-core`
- [x] 3.11 Update `ElevationChart.tsx` to import from `@trails-cool/map-core`

## 4. POI Categories

- [x] 4.1 Move `PoiCategory` type and `poiCategories` array from `poi-categories.ts` to `map-core/src/poi.ts`
- [x] 4.2 Move `getCategoriesForProfile()` and `profileOverlayDefaults` to `map-core/src/poi.ts`
- [x] 4.3 Update Planner imports: `PoiPanel.tsx`, `use-pois.ts`, `use-profile-defaults.ts`, `poi-categories.test.ts`
- [x] 4.4 Move POI snap distance constant to `map-core/src/snap.ts`

## 5. Z-Index Constants

- [x] 5.1 Move all z-index constants from `z-index.ts` to `map-core/src/z-index.ts`
- [x] 5.2 Update Planner imports: `PlannerMap.tsx`, `PoiPanel.tsx`, `RouteInteraction.tsx`

## 6. Verification

- [x] 6.1 Run `pnpm typecheck` — all packages compile
- [x] 6.2 Run `pnpm lint` — no import errors
- [x] 6.3 Run `pnpm test` — all existing tests pass (update import paths in test files)
- [x] 6.4 Run `pnpm test:e2e` — no regressions
- [x] 6.5 Verify `map-core` has zero dependencies in its `package.json`
