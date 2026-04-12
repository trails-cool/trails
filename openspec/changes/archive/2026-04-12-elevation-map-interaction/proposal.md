## Why

The elevation chart and map currently have one-directional interaction: hovering the chart shows a red dot on the map. But hovering the route on the map doesn't highlight the chart, clicking the chart doesn't pan the map, and there's no way to zoom into a section of the route from the chart. This makes it hard to correlate what you see on the map with what you see in the elevation profile.

## What Changes

- **Route hover → chart marker**: Hovering over the route polyline on the map shows the corresponding position on the elevation chart with a crosshair
- **Chart click → map pan**: Clicking on the elevation chart pans the map to center on that point along the route
- **Chart drag → map zoom**: Dragging/selecting a range on the elevation chart zooms the map to fit that section of the route

## Capabilities

### Modified Capabilities
- `route-coloring`: Elevation chart gains bidirectional interaction with the map
- `map-display`: Route polyline hover reports position back to the chart

## Impact

- `ElevationChart.tsx`: Add click handler (pan map), drag-select handler (zoom map), accept highlighted index from map hover
- `PlannerMap.tsx` / `ColoredRoute.tsx`: Route polyline hover finds closest point and reports index/position back to SessionView
- `SessionView.tsx`: Wire bidirectional state between chart and map
