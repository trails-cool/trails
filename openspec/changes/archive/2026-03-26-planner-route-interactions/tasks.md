## 1. BRouter Data Pipeline

- [x] 1.1 Modify `mergeGeoJsonSegments` to preserve 3D coordinates (lon, lat, ele) and track segment boundary indices
- [x] 1.2 Add `EnrichedRoute` interface with coordinates, segmentBoundaries, surfaces, and stats
- [x] 1.3 Store enriched route data (including segment boundaries and surfaces) in Yjs routeData map
- [x] 1.4 Add `tiledesc=true` to BRouter requests and extract surface types from WayTags messages
- [x] 1.5 Write unit test for segment boundary tracking across multi-waypoint routes

## 2. Route Interaction (ghost marker)

- [x] 2.1 Create `RouteInteraction` component — single persistent draggable Marker following brouter-web pattern
- [x] 2.2 Listen on `map.mousemove`, snap ghost marker to nearest route point within 15px tolerance (distance-based, not polyline events)
- [x] 2.3 On click, insert waypoint at snapped position using segment boundary lookup
- [x] 2.4 On drag, insert waypoint at drop position with trailer lines to adjacent waypoints
- [x] 2.5 Suppress map click handler after ghost insert to prevent duplicate waypoints
- [x] 2.6 Guard against flickering: `draggingRef` freezes snap updates during drag, distance-based mouseout
- [x] 2.7 Disable route interaction when no-go area drawing mode is active

## 3. Route Coloring

- [x] 3.1 Create `ColoredRoute` component — renders segmented L.Polyline instances with per-point colors
- [x] 3.2 Implement elevation gradient: normalize elevation to 0-1 range, map to green→yellow→red
- [x] 3.3 Implement surface coloring: extract surface types from BRouter tiledesc, map to color palette
- [x] 3.4 Fall back to plain mode when surface data is unavailable
- [x] 3.5 Add color mode state (`colorMode`) to Yjs routeData map, synced across participants
- [x] 3.6 Add color mode select dropdown to session header
- [x] 3.7 Sync elevation chart colors with route — use same `elevationColor()` gradient in ElevationChart
- [x] 3.8 Add i18n keys for color mode labels (en + de)

## 4. Verify

- [x] 4.1 E2E test: click near route inserts waypoint at correct position
- [x] 4.2 E2E test: color mode toggle switches between plain/elevation/surface
- [x] 4.3 E2E test: enriched route response includes segment boundaries and coordinates
- [x] 4.4 Unit test: segment boundary computation with 1, 2, and 4 segments
- [x] 4.5 Visual verification: ghost marker, drag with trailers, all color modes (cmux browser)
