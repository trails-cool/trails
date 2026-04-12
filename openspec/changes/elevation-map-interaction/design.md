## Context

The Planner has one-directional interaction: hovering the elevation chart shows
a red dot on the map via `highlightPosition` state in `SessionView`. The reverse
direction (map → chart) and click/drag interactions don't exist.

The route coordinates are stored in Yjs `routeData` as a JSON array of
`[lon, lat, ele]` points. The elevation chart extracts these into
`ElevationPoint[]` with cumulative distance. The map renders the route via
`ColoredRoute` as Leaflet polylines.

## Decisions

### D1: Route hover → chart highlight

Add a `mousemove` handler on the `ColoredRoute` polyline segments. On hover,
find the closest route coordinate index, compute the cumulative distance at
that index, and pass it up to `SessionView` as `highlightChartDistance`. The
`ElevationChart` receives this distance and draws the crosshair at that
position — reusing the existing `drawChart(highlightIdx)` mechanism.

To avoid expensive per-pixel distance calculations on every mousemove, use
Leaflet's `closestLayerPoint` or project to screen coordinates and find the
nearest point in the coordinate array.

### D2: Chart click → map pan

Add an `onClick` handler to the elevation chart canvas. Convert the click
x-position to a distance along the route, find the corresponding coordinate,
and call `map.panTo([lat, lon])` via a callback. The map reference is exposed
via `window.__leafletMap` (already used by E2E tests).

### D3: Chart drag-select → map zoom

Add mousedown/mousemove/mouseup handlers to the chart canvas for range
selection. While dragging, draw a semi-transparent overlay on the selected
range. On mouseup, compute the route coordinates within the selected distance
range and call `map.fitBounds()` on their bounding box.

A visual "reset zoom" button appears after drag-zoom to return to the full
route view.

### D4: State flow

```
SessionView
├── highlightPosition: [lat, lon] | null  (chart → map, existing)
├── highlightChartDistance: number | null  (map → chart, new)
└── onMapFitBounds: (bounds) => void      (chart → map, new)

ElevationChart
├── onHover(position)          — existing, chart → map
├── onClick(position)          — new, chart → map pan
├── onDragSelect(bounds)       — new, chart → map zoom
└── highlightDistance           — new, map → chart

PlannerMap / ColoredRoute
└── onRouteHover(distance)     — new, map → chart
```

## Risks / Trade-offs

- **Performance**: Route hover on the map triggers distance lookup on every
  mousemove. Mitigate by throttling and using screen-space projection.
- **Polyline interactivity**: ColoredRoute renders many small polyline segments.
  Making them all interactive adds event listeners. Alternative: use a single
  invisible overlay polyline for hover detection.
- **Drag conflict**: Chart drag-select must not conflict with chart hover.
  Use a minimum drag distance threshold (5px) before entering drag mode.
