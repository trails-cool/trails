## Why

The Planner's route editing is click-only: users place waypoints and the route
auto-computes between them. But refining a route is tedious — you can't insert
a waypoint on the route itself, drag a route segment to reshape it, or see what
kind of terrain you're heading into. These are table-stakes features in modern
route planners (bikerouter.de, komoot, Ride with GPS) and the most common
feedback from early testers.

## What Changes

- **Route splitting**: Hover near the route to see a ghost marker at the nearest
  point. Click it to insert a new waypoint, splitting the segment. The waypoint
  snaps to the closest coordinate on the existing route.
- **Drag-to-reshape**: Drag the ghost marker to a new position to reshape the
  route. Dashed trailer lines connect to adjacent waypoints during drag.
  Inspired by brouter-web's single-persistent-marker pattern.
- **Colored route rendering**: Replace the single-color route polyline with
  segments colored by elevation gradient or surface type (from BRouter's
  per-point data). Users toggle between plain, elevation, and surface color
  modes. Elevation chart syncs with route colors in elevation mode.

## Capabilities

### New Capabilities

- `route-splitting`: Insert waypoints by clicking the ghost marker on the route,
  with snapping to the nearest route coordinate
- `route-drag-reshape`: Drag the ghost marker to reshape the route interactively
  with trailer lines and text selection prevention
- `route-coloring`: Color-code the route polyline by elevation gradient or
  surface type using BRouter tiledesc data, with elevation chart color sync

### Modified Capabilities

- `map-display`: Route visualization changes from a single-color polyline to
  a segmented, interactive polyline with color modes and ghost marker interaction
- `brouter-integration`: BRouter requests include `tiledesc=true`; response data
  (elevation, surface tags, segment boundaries) preserved in EnrichedRoute

## Impact

- **PlannerMap.tsx**: Route polyline becomes interactive via RouteInteraction
  component with ghost marker, map click suppression
- **brouter.ts**: EnrichedRoute with per-point 3D coordinates, segment
  boundaries, and surface types extracted from BRouter tiledesc WayTags
- **use-routing.ts**: Stores enriched data (coordinates, boundaries, surfaces)
  in Yjs routeData map
- **New components**: RouteInteraction (ghost marker + drag), ColoredRoute
  (segmented polyline renderer)
- **ElevationChart**: Uses same `elevationColor()` gradient as route in
  elevation mode
- **Dependencies**: No new dependencies (uses Leaflet's built-in L.Draggable)
- **i18n**: New keys for color mode labels (en + de)
