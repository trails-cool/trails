## 1. Data Extraction & Pipeline

- [x] 1.1 Extend `extractSurfacesFromMessages` in `brouter.ts` to also extract `highway=*` tags, returning a `Map<number, string>` for highways
- [x] 1.2 Add `highways: string[]` field to `EnrichedRoute` interface in `brouter.ts`
- [x] 1.3 Populate the `highways` array in `mergeGeoJsonSegments` using the extracted highway tags
- [x] 1.4 Store highway data in Yjs `routeData` in `use-routing.ts` (same pattern as surfaces)

## 2. Color Palette & Types

- [x] 2.1 Extend `ColorMode` type in `ColoredRoute.tsx` to include `"highway"`
- [x] 2.2 Define `HIGHWAY_COLORS` mapping and `DEFAULT_HIGHWAY_COLOR` in `ColoredRoute.tsx` (reds for major roads, grays/blues for urban, greens for paths/cycling)
- [x] 2.3 Export `HIGHWAY_COLORS` and `DEFAULT_HIGHWAY_COLOR` for use in the elevation chart

## 3. Map Polyline Coloring

- [x] 3.1 Add highway coloring branch in `ColoredRoute` component — color segments by highway type from a `highways` prop
- [x] 3.2 Pass `highways` data from `PlannerMap.tsx` to `ColoredRoute`

## 4. Elevation Chart

- [x] 4.1 Read `highways` from Yjs `routeData` in `ElevationChart.tsx` (same pattern as surfaces)
- [x] 4.2 Add highway-colored segment rendering in `drawChart` (fill + line, matching surface pattern)
- [x] 4.3 Add road type legend display when `colorMode === "highway"` (colored swatches, max 6 with overflow)
- [x] 4.4 Add highway type name to hover label when `colorMode === "highway"`
- [x] 4.5 Update chart title to show "Road Type Profile" when in highway mode

## 5. UI & Color Mode Toggle

- [x] 5.1 Add "Road Type" / "highway" option to the color mode `<select>` dropdown in `ElevationChart.tsx`

## 6. Internationalization

- [x] 6.1 Add English i18n keys: `colorMode.highway` ("Road Type"), `elevation.highway` ("Road Type Profile")
- [x] 6.2 Add German i18n keys: `colorMode.highway` ("Straßentyp"), `elevation.highway` ("Straßentypenprofil")

## 7. Testing

- [x] 7.1 Add `highways` data to BRouter mock fixtures in `e2e/fixtures/brouter-mock.ts`
- [x] 7.2 Add unit tests for highway tag extraction in `brouter.ts`
- [x] 7.3 Add E2E test: switch to road type color mode and verify chart renders
- [x] 7.4 Add E2E test: verify road type hover label shows highway type name
