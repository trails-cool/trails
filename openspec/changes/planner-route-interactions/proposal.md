## Why

The Planner's route editing is click-only: users place waypoints and the route
auto-computes between them. But refining a route is tedious — you can't insert
a waypoint on the route itself, drag a route segment to reshape it, or see what
kind of terrain you're heading into. These are table-stakes features in modern
route planners (bikerouter.de, komoot, Ride with GPS) and the most common
feedback from early testers.

## What Changes

- **Route splitting**: Click on the route polyline to insert a new waypoint at
  that position, splitting the segment. The waypoint snaps to the closest point
  on the existing route.
- **Drag-to-reshape**: Invisible midpoint handles appear between waypoints on
  the route. Dragging a midpoint inserts a new waypoint and triggers route
  recomputation — the natural way to push a route onto a different path.
- **Colored route rendering**: Replace the single-color route polyline with
  segments colored by elevation gradient or surface type (from BRouter's
  per-point data). Users can toggle between plain, elevation, and surface
  color modes.

## Capabilities

### New Capabilities

- `route-splitting`: Insert waypoints by clicking on the route polyline, with
  snapping to the nearest route point
- `route-drag-reshape`: Drag midpoint handles on route segments to reshape the
  route interactively
- `route-coloring`: Color-code the route polyline by elevation gradient or
  surface type using BRouter track data

### Modified Capabilities

- `map-display`: Route visualization changes from a single-color polyline to
  a segmented, interactive polyline with color modes and click/drag interactions
- `brouter-integration`: BRouter response data (elevation per point, surface
  tags) must be preserved and exposed to the rendering layer

## Impact

- **PlannerMap.tsx**: Major changes — route polyline becomes interactive with
  click-to-split and drag midpoint handles
- **brouter.ts**: Expose per-point elevation and surface data from GeoJSON
  properties (currently only track-level stats are extracted)
- **use-routing.ts**: Support waypoint insertion at specific indices (not just
  append)
- **use-yjs.ts**: Waypoint insertion at arbitrary positions (already supported
  by Y.Array.insert)
- **New components**: ColoredRoute (segmented polyline renderer),
  MidpointHandles (draggable reshape markers)
- **ElevationChart**: Add hover-to-highlight sync with colored route
- **Dependencies**: May need `leaflet-hotline` for smooth gradient rendering,
  or custom canvas renderer
- **i18n**: New keys for color mode labels (en + de)
