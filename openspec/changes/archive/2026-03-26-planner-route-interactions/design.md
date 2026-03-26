## Context

The Planner currently renders routes as a single-color `L.Polyline` with no
interactivity — users can't click on the route or drag it. Waypoints can only
be appended (click on map) or reordered in the sidebar. BRouter returns
per-point elevation in coordinates (`[lon, lat, ele]`) and can return surface
tags, but `mergeGeoJsonSegments` currently discards all per-point data and
only keeps track-level totals.

bikerouter.de and komoot both support click-to-split and drag-to-reshape as
primary editing interactions. These are the most natural way to refine a route
after the initial waypoints are placed.

## Goals / Non-Goals

**Goals:**
- Hover over the route to see a transient ghost marker at the nearest route point
- Click or drag the ghost marker to insert a waypoint (split / reshape)
- Color the route by elevation gradient (green→yellow→red) or surface type
- Sync elevation chart colors with route coloring in elevation mode
- Preserve per-point data from BRouter through the merge pipeline
- All interactions synced via Yjs (collaborative)

**Non-Goals:**
- Undo/redo system (future change)
- Route alternatives (show multiple options)
- Custom color gradient configuration
- Surface type legend or detailed surface info panel
- Offline route coloring (requires BRouter data)

## Decisions

### D1: Ghost marker interaction (inspired by brouter-web)

Following brouter-web's `L.Routing.Edit` pattern: a **single persistent
draggable Marker** (`RouteInteraction` component) that appears when the cursor
is near the route and can be clicked or dragged to insert a waypoint.

Key techniques from brouter-web:
- **Distance-based snap**: Listen on `map.mousemove`, compute pixel distance
  to nearest route coordinate (15px tolerance). No reliance on SVG polyline
  mouseout events (which cause flickering).
- **Single reusable marker**: Created once via `L.marker({ draggable: true })`,
  shown/hidden with `addTo(map)`/`remove()`. Not destroyed/recreated on each
  hover.
- **Dragging guard**: `draggingRef` flag freezes snap updates during drag and
  prevents hide-on-mouseout.
- **Leaflet's built-in drag**: `draggable: true` on the Marker uses Leaflet's
  `L.Draggable` which automatically calls `L.DomUtil.disableTextSelection()`
  during drag and re-enables on dragend.
- **Trailer lines**: Two persistent dashed `L.Polyline` instances shown during
  drag, connecting the ghost to adjacent waypoints for visual feedback.

**Alternative considered and rejected**: Fixed midpoint CircleMarkers between
waypoints. Caused flickering (render loop between marker and polyline events),
required zoom threshold to avoid clutter, and `CircleMarker` SVG rendering
was unreliable in react-leaflet after programmatic zoom.

**Alternative considered and rejected**: Invisible wide polyline for click
detection. Playwright couldn't trigger mousemove events on SVG paths with
opacity 0. The map-level listener with distance-based snap is more reliable.

### D2: Per-point data preservation in BRouter response

BRouter GeoJSON coordinates are `[lon, lat, ele]`. For surface data, BRouter's
`tiledesc=true` parameter includes per-point `WayTags` in the
`properties.messages` array (e.g., `surface=asphalt highway=primary`).

`mergeGeoJsonSegments` now:
1. Preserves full 3D coordinates `[lon, lat, ele]`
2. Tracks segment boundary indices (where each waypoint segment starts)
3. Extracts surface type per point from `WayTags` via regex

The `EnrichedRoute` interface:

```typescript
interface EnrichedRoute {
  coordinates: [number, number, number][]; // [lon, lat, ele]
  segmentBoundaries: number[];             // coordinate index where each segment starts
  surfaces: string[];                      // surface type per point (from WayTags)
  totalLength: number;
  totalAscend: number;
  totalTime: number;
  geojson: GeoJsonCollection;              // backwards compat
}
```

All enriched data is stored in `routeData` Y.Map (as JSON strings) so all
participants receive it.

### D3: Colored route rendering with segmented polylines

`ColoredRoute` component renders multiple `L.Polyline` segments colored by
per-point data. Three modes toggled via a `<select>` in the session header,
synced via Yjs `routeData.colorMode`:

1. **Plain**: Single-color blue polyline (default)
2. **Elevation**: green→yellow→red gradient normalized to route elevation range
3. **Surface**: Fixed color palette per surface type (asphalt=gray, gravel=brown,
   path=green, track=orange, etc.). Falls back to plain if surface data
   unavailable.

### D4: Elevation chart color sync

`ElevationChart` reads `colorMode` from Yjs and uses the same `elevationColor()`
function as `ColoredRoute` when in elevation mode. Each chart segment is drawn
with the corresponding elevation color for both the fill and line.

### D5: Map click suppression

When the ghost marker click or drag inserts a waypoint, a `suppressMapClickRef`
flag prevents the subsequent `MapClickHandler` from also appending a waypoint.
This solves the Leaflet event model issue where map click fires independently
from layer click.

## Risks / Trade-offs

- **Performance with many segments** → Hundreds of small `L.Polyline` instances
  for colored rendering could be slow. Can switch to canvas if needed later.
- **BRouter surface data availability** → Not all BRouter profiles return
  surface tags. Surface coloring falls back to plain when data is missing.
- **Snap precision** → Distance-based snap at 15px works well at typical zoom
  levels. On very dense routes, the nearest coordinate might be slightly off
  from the visual route line.
- **Playwright E2E limitations** → Ghost marker hover can't be reliably tested
  via Playwright's mouse simulation on Leaflet SVG. Verified visually via
  cmux browser instead.
