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
- Click on the route polyline to insert a waypoint at that position
- Drag midpoint handles between waypoints to reshape the route
- Color the route by elevation gradient (green→yellow→red) or surface type
- Preserve per-point data from BRouter through the merge pipeline
- All interactions synced via Yjs (collaborative)

**Non-Goals:**
- Undo/redo system (future change)
- Route alternatives (show multiple options)
- Custom color gradient configuration
- Surface type legend or detailed surface info panel
- Offline route coloring (requires BRouter data)

## Decisions

### D1: Click-to-split via Leaflet polyline event

Listen for `click` on the route polyline. On click, find the closest point on
the route geometry, determine which waypoint segment it falls in (between
waypoint N and N+1), and insert a new waypoint at that position using
`Y.Array.insert(N+1, [newWaypoint])`.

To find the segment index: the route is computed segment-by-segment (one per
consecutive waypoint pair). Track the coordinate count per segment in the
merged GeoJSON so we can map any route point index back to a waypoint segment.

**Alternative considered**: Using a separate invisible polyline for click
detection. Unnecessary — Leaflet's built-in polyline click events work fine
with appropriate `weight` for hit detection.

### D2: Midpoint handles as draggable CircleMarkers

For each consecutive pair of waypoints, render a small, semi-transparent
`L.CircleMarker` at the geographic midpoint of the route segment (not the
straight-line midpoint — use the actual route geometry midpoint). On drag
start, the handle becomes opaque and turns into a waypoint drag. On drag end,
insert a new waypoint at the dropped position.

Handles are only visible on hover or at higher zoom levels to avoid clutter.
They reposition after each route computation.

**Alternative considered**: Handles at the straight-line midpoint between
waypoints. Bad UX — on a winding route, the midpoint may be far from the
actual route.

### D3: Per-point data preservation in BRouter response

BRouter GeoJSON coordinates are `[lon, lat, ele]` — elevation is already
present but currently unused beyond the ElevationChart. For surface data,
BRouter supports a `tiledesc` parameter that includes waytype/surface tags
per point in the `properties.messages` array.

Modify `mergeGeoJsonSegments` to:
1. Preserve the full 3-element coordinates (already done, but not exposed)
2. Track segment boundaries (array of indices where each waypoint segment starts)
3. Optionally parse `properties.messages` for surface tags

Store the enriched data in `routeData` Y.Map so all participants have it.

### D4: Colored route rendering with segmented polylines

Use multiple `L.Polyline` instances, each covering a short segment of the
route with a color based on the data value at that point. For elevation:
normalize elevation values to 0-1 range across the route, map to a
green→yellow→red gradient. For surface: map surface type strings to a fixed
color palette (asphalt=gray, gravel=brown, path=green, etc.).

Three rendering modes, toggled by a button in the header:
1. **Plain**: Current single-color blue polyline (default)
2. **Elevation**: Gradient by elevation
3. **Surface**: Colored by surface type

**Alternative considered**: `leaflet-hotline` for smooth canvas-based gradient
rendering. Better visual quality but adds a dependency and doesn't support
click events on the colored line. Since we need click-to-split on the route,
we need real Leaflet layers. Can revisit later if performance is an issue.

**Alternative considered**: Single Canvas renderer. Better performance for
very long routes but much more complex, and breaks Leaflet's event model.
Not needed at current route lengths (<1000 points typical).

### D5: Segment boundary tracking

The key data structure bridging BRouter output and map interactions:

```typescript
interface EnrichedRoute {
  coordinates: [number, number, number][]; // [lon, lat, ele]
  segmentBoundaries: number[];             // indices where each waypoint segment starts
  surfaces?: string[];                     // surface type per point (optional)
  totalLength: number;
  totalAscend: number;
  totalTime: number;
}
```

`segmentBoundaries[i]` is the coordinate index where the route segment from
waypoint `i` to waypoint `i+1` starts. This enables:
- Click-to-split: find which segment a clicked point belongs to
- Midpoint handles: find the midpoint of each segment's geometry
- Per-segment coloring: color differently per waypoint pair if needed

## Risks / Trade-offs

- **Performance with many segments** → Hundreds of small `L.Polyline` instances
  for colored rendering could be slow. Mitigate: batch updates, only re-render
  changed segments, limit color segments to ~100 per route. Can switch to
  canvas if needed later.
- **BRouter surface data availability** → Not all BRouter profiles return
  surface tags. The `tiledesc` parameter may not work with all profiles.
  Mitigate: surface coloring is optional; elevation always works (from coords).
- **Click precision on thin polylines** → Hard to click a 4px line on mobile.
  Mitigate: use `L.Polyline` `weight` for rendering but a wider invisible
  polyline for click detection.
- **Midpoint handle clutter** → Routes with many waypoints get cluttered.
  Mitigate: only show handles on hover or at zoom level ≥ 12.
