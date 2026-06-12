## Context

`@trails-cool/gpx` already parses trackpoints with elevation; the detail loaders
already build GeoJSON for the map. The Planner's `elevation-map-interaction`
spec defines the hover/click/drag behavior in an editing context (Yjs-backed).
The Journal detail pages are read-only React Router routes that render a Leaflet
map (`ClientMap` / `RouteMapThumbnail.client`) but no chart.

## Goals / Non-Goals

**Goals**
- A self-contained, read-only elevation profile on both detail pages.
- A shared "active distance" so the map and chart highlight the same point.

**Non-Goals**
- No editing (the Planner owns reshape/drag-select-to-zoom); clicking the chart
  centers the map but changes no data.
- No multi-series overlay (HR/pace/cadence) — we don't store per-point fitness
  data, and it's out of scope/ethos.
- No schema or API changes; the series is derived from existing `gpx`.

## Decisions

### D1: Series derivation
A helper returns an array of `{ distance, elevation, lat, lng }` samples from
the GPX (reusing the gpx package's parse), downsampled to a sensible cap (e.g.
~500 points) for chart performance. Computed in the loader (server) so the chart
component stays presentational.

### D2: Chart rendering
An SVG area chart (no charting dependency): x = cumulative distance, y =
elevation, gradient fill keyed to gradient steepness using the existing
`map-core` elevation/gradient color scale. A summary strip beneath shows ascent,
descent, highest, and lowest — formatted via the shared stat helpers from
`activity-stats` when present, else local formatting.

### D3: Shared "active distance" state
The detail page lifts an `activeDistance | null` state above both the map and
the chart:
- Hovering the chart sets `activeDistance`; the map shows a marker at the
  interpolated lat/lng for that distance.
- Hovering the route polyline on the map sets `activeDistance` (nearest sample);
  the chart draws a crosshair/marker at that x.
- Clicking the chart pans/centers the map on that point.
This mirrors the Planner's interaction conceptually but is read-only and
implemented independently for the Journal surface.

### D4: Graceful absence
If the derived series has no elevation variation or no elevation data (e.g. a
flat import or a planned route without elevation), the chart is not rendered and
the existing gain/loss numbers stand alone.

## Risks / Trade-offs

- **Map↔chart coupling**: the shared state must avoid render thrash on hover;
  throttle pointer updates and memoize the interpolation.
- **Reuse vs. duplication with the Planner**: we deliberately implement a
  separate read-only component rather than lifting the Planner's editing
  component, to keep the Journal free of Yjs/editing concerns. The shared piece
  is the gpx series helper and the map-core color scale, not the component.
