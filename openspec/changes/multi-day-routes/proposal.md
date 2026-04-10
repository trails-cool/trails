## Why

Long routes -- multi-day bike tours, thru-hikes, extended backpacking trips --
are flat lists of waypoints with no structure. Users planning a 5-day ride from
Berlin to Prague have no way to mark where each day ends, see per-day distance
and climbing, or reason about daily effort. They resort to external spreadsheets
or mental arithmetic to divide the route into manageable stages.

The Planner already computes total distance and elevation across the full route.
Adding day structure is a matter of marking overnight stops on existing waypoints
and deriving per-day stats from the segment data we already have.

## What Changes

- **Day-break waypoints**: Any waypoint can be toggled as an overnight stop.
  This adds an `overnight: true` flag to the waypoint's Y.Map in the existing
  Yjs waypoints array. First and last waypoints are implicit day boundaries.
- **Per-day stats**: Distance, total ascent, and estimated duration computed per
  day by splitting the route at overnight waypoints. Derived from the existing
  `segmentBoundaries` and `coordinates` in the enriched route data.
- **Sidebar day breakdown**: Waypoints grouped by day with collapsible sections,
  per-day stats, and overnight toggle. Day 1 expanded by default.
- **Elevation chart day dividers**: Dashed vertical lines at day boundaries with
  "Day N" labels.
- **Map day labels**: White pill markers on the route at day boundaries showing
  "Day 1 . 120 km".
- **GPX export**: Day-break waypoints exported with a `<type>overnight</type>`
  element so the structure survives round-trips.
- **Waypoint highlighting**: Hovering a waypoint in the sidebar highlights
  the corresponding marker on the map with a smooth scale animation.
- **Journal day interaction**: Hovering a day in the Journal route detail
  highlights that segment on the map and flies the map to fit it.
- **Per-day GPX export**: Each day in the Journal route detail has a GPX
  download button that exports just that day's track segment.

All state lives in Yjs. No database changes are needed -- the Planner remains
stateless. The visual design is already specified in the `visual-redesign`
change (D4 sidebar, D5 map markers, D6 elevation chart); this spec covers
the data model, computation logic, and integration wiring.

## Capabilities

### New Capabilities

- `multi-day-routes`: Overnight waypoint markers, per-day stats computation,
  day-aware sidebar/chart/map display, multi-day GPX export

### Modified Capabilities

- `planner-session`: Waypoints gain an `overnight` property in Yjs state
- `map-display`: Day boundary labels on route, overnight marker styling
- `gpx-export`: Day-break metadata in exported GPX waypoints
- `gpx-import`: Parse `<type>overnight</type>` waypoints to restore day breaks
- `route-management`: Populate `dayBreaks` column on save, expose per-day stats
- `journal-route-detail`: Day breakdown display with per-day stats, map segment
  highlighting, fly-to-segment on hover, per-day GPX export
- `planner-sidebar`: Waypoint hover highlights corresponding map marker

## Non-Goals

- **Automatic day splitting**: No algorithm to suggest where to stop. Users
  decide manually. This avoids opinionated defaults and keeps the logic simple.
- **Accommodation search**: No POI lookup for campsites or hotels. Out of scope.
- **Per-day routing profiles**: All days use the same BRouter profile. Supporting
  different profiles per day would require rearchitecting the routing pipeline.
- **Per-day activity tracking**: Linking individual activities to specific days
  of a multi-day route (e.g. "Day 2 activity"). Activities remain linked to the
  full route. Per-day activity chaining is a future concern.

## Impact

- **Yjs state**: `overnight` boolean added to waypoint Y.Map entries (additive,
  backwards-compatible -- existing sessions without it behave as single-day)
- **Shared types**: `Waypoint.isDayBreak` already exists in `@trails-cool/types`
  but is unused. This change activates it.
- **New utility**: `compute-days.ts` -- pure function that splits route data at
  overnight waypoints and returns per-day stats
- **Sidebar**: `WaypointSidebar.tsx` gains day-grouped view with collapsible
  sections and overnight toggle buttons
- **ElevationChart**: Canvas drawing extended with vertical day dividers
- **Map**: New day-label layer and overnight marker variant
- **GPX generate**: `generateGpx` extended to emit `<type>overnight</type>` on
  day-break waypoints
- **GPX parse**: `parseGpx` extended to recognize `<type>overnight</type>` and
  set `isDayBreak: true` on parsed waypoints
- **Journal route storage**: `updateRoute` populates `dayBreaks` column from
  parsed waypoint indices when saving GPX
- **Journal route detail**: Day breakdown section with per-day stats (distance,
  ascent, descent) when `dayBreaks` is non-empty. Hover highlights segment on
  map and flies to fit. Per-day GPX download via `?day=N` query param.
- **Sidebar hover**: Hovering waypoint rows highlights the marker on the map
  with CSS `scale(1.17)` transition (0.2s ease)
- **i18n**: New keys for day labels, overnight toggle, per-day stats (en + de)
  in both planner and journal namespaces
