## Why

The Planner already visualizes surface type, grade, and elevation along a route, but there is no way to see the **road type** (highway classification). Cyclists and hikers care whether their route follows a motorway-class road, a residential street, a cycle path, or a forest track — this affects comfort, safety, and legality. BRouter already returns `highway=*` tags in its tiledesc messages alongside surface data, so the information is available but unused.

## What Changes

- Add a new "Road Type" color mode to the route visualization (map polyline + elevation chart)
- Extract `highway=*` tags from BRouter tiledesc messages alongside existing `surface=*` extraction
- Pass road type data through the routing pipeline (BRouter → Yjs → chart/map)
- Add a road type color palette and legend
- Show road type name on chart hover
- Add i18n strings (EN + DE) for the new mode and chart label

## Capabilities

### New Capabilities
- `road-type-coloring`: Road type color mode for route visualization — extracting highway tags from BRouter, coloring the map polyline and elevation chart by road classification, with legend and hover info

### Modified Capabilities
- `route-coloring`: Add "Road Type" as a new color mode option in the color mode toggle, legend display, and chart hover behavior

## Impact

- `apps/planner/app/lib/brouter.ts` — extract `highway=*` tags, add `highways` field to `EnrichedRoute`
- `apps/planner/app/lib/use-routing.ts` — store highway data in Yjs routeData
- `apps/planner/app/components/ColoredRoute.tsx` — extend `ColorMode` type, add highway coloring logic
- `apps/planner/app/components/ElevationChart.tsx` — add highway chart rendering, legend, hover label
- `packages/i18n/src/locales/en.ts` + `de.ts` — new i18n keys
- `e2e/fixtures/brouter-mock.ts` — add highway data to mock responses
- E2E tests — cover the new color mode
