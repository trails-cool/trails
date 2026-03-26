## 1. BRouter Data Pipeline

- [x] 1.1 Modify `mergeGeoJsonSegments` to preserve 3D coordinates (lon, lat, ele) and track segment boundary indices
- [x] 1.2 Add `EnrichedRoute` interface with coordinates, segmentBoundaries, surfaces, and stats
- [x] 1.3 Store enriched route data (including segment boundaries) in Yjs routeData map
- [x] 1.4 Write unit test for segment boundary tracking across multi-waypoint routes

## 2. Route Splitting (click-to-insert)

- [x] 2.1 Make the route polyline clickable — add click event handler to route Polyline in PlannerMap
- [x] 2.2 On click, find nearest point on route geometry and determine which waypoint segment it belongs to (using segment boundaries)
- [x] 2.3 Insert new waypoint at the clicked position using `Y.Array.insert(segmentIndex + 1, [waypoint])`
- [x] 2.4 Add wider invisible polyline behind the route for easier click targeting (hit area)

## 3. Drag-to-Reshape (midpoint handles)

- [x] 3.1 Create MidpointHandles component — renders a CircleMarker at the geographic midpoint of each route segment
- [x] 3.2 Compute geographic midpoint from actual route geometry (not straight-line between waypoints)
- [x] 3.3 On drag end, insert waypoint at dropped position between the two adjacent waypoints
- [x] 3.4 Hide midpoint handles below zoom level 12
- [x] 3.5 Style handles: semi-transparent by default, opaque on hover, match waypoint color scheme

## 4. Route Coloring

- [x] 4.1 Create ColoredRoute component — renders multiple short L.Polyline segments with per-point colors
- [x] 4.2 Implement elevation gradient: normalize elevation values to 0-1 range, map to green→yellow→red
- [x] 4.3 Implement surface coloring: map BRouter surface type strings to a fixed color palette
- [x] 4.4 Add color mode state to Yjs routeData map ("plain" | "elevation" | "surface")
- [x] 4.5 Add color mode toggle button to session header (icon or dropdown)
- [x] 4.6 Fall back to plain mode when surface data is unavailable
- [x] 4.7 Add i18n keys for color mode labels (en + de)

## 5. Integration

- [x] 5.1 Replace single Polyline in PlannerMap with ColoredRoute + click handler + MidpointHandles
- [x] 5.2 Ensure click-to-split and drag-to-reshape work alongside no-go area drawing mode (disable route interactions when drawing)
- [x] 5.3 Update ElevationChart hover sync to work with the new colored route

## 6. Verify

- [x] 6.1 E2E test: click on route inserts waypoint at correct position
- [x] 6.2 E2E test: color mode toggle switches between plain/elevation/surface
- [x] 6.3 Unit test: segment boundary computation with 2, 3, and 5 waypoints
- [x] 6.4 Verify midpoint handles reposition after route recomputation
- [x] 6.5 Verify all interactions sync correctly between two browser tabs
