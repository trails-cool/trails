## Context

The Planner stores waypoints as a Yjs `Y.Array<Y.Map<unknown>>` where each
Y.Map holds `lat`, `lon`, and optionally `name`. Routes are computed
segment-by-segment between consecutive waypoints via BRouter, producing an
`EnrichedRoute` with `coordinates`, `segmentBoundaries`, `totalLength`,
`totalAscend`, and `totalTime`. The visual-redesign change already defines the
UI treatment for multi-day routes (sidebar day breakdown, elevation chart
dividers, map day labels) but explicitly defers the data model and logic.

This design covers the data model, computation, and integration decisions.

## Decisions

### D1: Day-break waypoints via `overnight` flag

A waypoint becomes a day boundary by setting `overnight: true` on its Y.Map.
The first waypoint of the route is the implicit start of Day 1, the last
waypoint is the implicit end of the final day, and every waypoint with
`overnight: true` marks the end of one day and start of the next.

```
Waypoints: [Berlin, Zossen, Dessau(overnight), Halle, Erfurt]
           |------- Day 1 -------||------- Day 2 ------|
```

This is the simplest possible model: a single boolean on existing data. No new
Yjs types, no separate array, no ordering concerns. It composes naturally with
waypoint reordering, insertion, and deletion -- if an overnight waypoint is
removed, the two days merge automatically.

### D2: Day computation as a pure utility

A `computeDays()` function takes the waypoints array and the `EnrichedRoute`
and returns an array of day objects:

```typescript
interface DayStage {
  dayNumber: number;
  startWaypointIndex: number;
  endWaypointIndex: number;
  startName: string;
  endName: string;
  distance: number;      // meters
  ascent: number;        // meters
  descent: number;       // meters
  estimatedTime: number; // seconds
  coordStartIndex: number;
  coordEndIndex: number;
}

function computeDays(
  waypoints: Array<{ lat: number; lon: number; name?: string; overnight?: boolean }>,
  route: EnrichedRoute,
): DayStage[];
```

The function walks `segmentBoundaries` to map waypoint indices to coordinate
ranges, then accumulates distance and elevation per day by iterating
coordinates within each range. If no waypoints have `overnight: true`, it
returns a single day covering the entire route.

This is a pure function with no Yjs dependency -- it takes plain data and
returns plain data. This makes it easy to test and reuse.

### D3: Yjs state -- minimal addition

The only change to Yjs state is adding an `overnight` key to waypoint Y.Maps:

```typescript
// Setting overnight on a waypoint
const waypointMap = yjs.waypoints.get(index);
waypointMap.set("overnight", true);

// Clearing overnight
waypointMap.delete("overnight");
```

No new Y.Array or Y.Map types are introduced. The `overnight` key is optional
-- existing waypoints without it are treated as regular (non-overnight)
waypoints. This is fully backwards-compatible: sessions created before this
feature work identically, and clients that don't understand `overnight` simply
ignore it.

The existing crash-recovery logic (periodic localStorage save of Y.Doc state)
preserves overnight flags automatically since they are part of the Y.Doc.

### D4: Sidebar day breakdown

The `WaypointSidebar` component gains a day-grouped view when any waypoint has
`overnight: true`. The layout follows visual-redesign D4:

```
ACTIVE ROUTE
Berlin -> Erfurt  343 km  ^868m  2 days

DAY 1 - Berlin -> Dessau              [v]
  ^340m  120 km  ~4h 30m
  1. Berlin Alexanderplatz
  2. Zossen
  3. Juterbog
  4. Dessau [OVERNIGHT]

> DAY 2 - Dessau -> Erfurt  223 km    [>]

(collapsed days show summary only)
```

**Behavior:**
- Day 1 is expanded by default; other days are collapsed
- Clicking a day header toggles expand/collapse
- Per-day stats (distance, ascent, estimated time) shown in day header
- Overnight waypoints display an amber badge
- Waypoints within each day are numbered sequentially (1, 2, 3... restarting
  per day would be confusing -- use global numbering)
- When no waypoints have `overnight: true`, the sidebar shows the flat list
  as it does today (no "Day 1" wrapper for single-day routes)

### D5: Elevation chart day dividers

The `ElevationChart` canvas drawing is extended to render day boundaries as
vertical dashed lines. For each day boundary (overnight waypoint), the
corresponding distance along the route is computed from `segmentBoundaries`
and `coordinates`, and a dashed vertical line is drawn at that x-position.

```
       Day 1          Day 2         Day 3
  ___/\__/\___  :  __/\_____  :  __/\___
 /             \ : /         \ : /       \
/_______________\:/___________\:/________\
0 km      120 km  120 km 250 km  250 km 343 km
```

Each divider has a "Day N" label at the top of the chart area. The dashed line
uses a muted color (`--text-lo` / `#9A9484`) to avoid competing with the
elevation profile. This follows visual-redesign D6.

### D6: Map day labels

White pill-shaped labels are placed on the route at each day boundary, showing
"Day 1 . 120 km". These use Leaflet DivIcon markers positioned at the
coordinate of the overnight waypoint.

Styling follows visual-redesign D5:
- White background with subtle shadow (`--shadow-sm`)
- Text in `--text-hi` with distance in `--font-mono`
- Positioned slightly offset from the route line to avoid overlap with the
  route itself

Day labels are only shown when there are 2+ days. They update reactively when
overnight flags change (same Yjs observe pattern as existing markers).

### D7: GPX export with day-break metadata

Day-break waypoints are exported with a `<type>overnight</type>` element inside
the `<wpt>` tag. This is valid GPX 1.1 (the `<type>` element is a standard
child of `<wpt>`).

```xml
<wpt lat="51.8365" lon="12.2428">
  <name>Dessau</name>
  <type>overnight</type>
</wpt>
```

Additionally, the track can optionally be split into multiple `<trk>` elements
(one per day), each with a `<name>` like "Day 1: Berlin - Dessau". This gives
GPS devices and other tools a natural per-day breakdown. The single-track export
remains the default; multi-track is an option in the export dialog.

On GPX import (future), the parser should recognize `<type>overnight</type>`
waypoints and restore the overnight flags. This is not in scope for this change
but the format is designed to support it.

### D8: Overnight toggle UX

Two interaction paths to toggle a waypoint as overnight:

1. **Sidebar**: Each waypoint row in the sidebar gains an overnight toggle
   button (crescent moon icon). Clicking it sets/clears `overnight` on the
   waypoint's Y.Map. The button uses amber styling (`--stop`, `--stop-bg`)
   when active.

2. **Map context menu**: Right-clicking (long-press on mobile) a waypoint
   marker on the map shows a context menu with "Mark as overnight stop" /
   "Remove overnight stop". This reuses the same Y.Map mutation.

Visual feedback follows visual-redesign tokens:
- Overnight waypoint markers on the map use amber-brown (`--stop`: `#8B6D3A`)
  instead of the default olive (`--accent`: `#4A6B40`)
- Sidebar overnight waypoints have a subtle amber background (`--stop-bg`)
- The "OVERNIGHT" badge uses `--stop` text on `--stop-bg` background with
  `--stop-border` border

### D9: GPX parse recognizes overnight waypoints

The `parseWaypoints` function in `packages/gpx/src/parse.ts` is extended to
check for `<type>overnight</type>` inside `<wpt>` elements. When found, the
returned `Waypoint` has `isDayBreak: true`.

```typescript
function parseWaypoints(doc: Document): Waypoint[] {
  const wpts = doc.querySelectorAll("wpt");
  return Array.from(wpts).map((wpt) => {
    const lat = parseFloat(wpt.getAttribute("lat") ?? "0");
    const lon = parseFloat(wpt.getAttribute("lon") ?? "0");
    const name = wpt.querySelector("name")?.textContent ?? undefined;
    const type = wpt.querySelector("type")?.textContent ?? undefined;
    const isDayBreak = type === "overnight" ? true : undefined;
    return { lat, lon, name, isDayBreak };
  });
}
```

This makes GPX round-tripping work: Planner exports overnight waypoints with
`<type>overnight</type>` (D7), and any consumer — the Journal's `updateRoute`,
the Planner's GPX import, or a future mobile app — gets `isDayBreak` back.

### D10: Journal stores dayBreaks on route save

The `dayBreaks` jsonb column on `journal.routes` already exists. When
`updateRoute` receives GPX and calls `parseGpxAsync`, it extracts the indices
of waypoints where `isDayBreak === true` and writes them to `dayBreaks`:

```typescript
const parsed = await parseGpxAsync(gpx);
const dayBreaks = parsed.waypoints
  .map((w, i) => (w.isDayBreak ? i : -1))
  .filter((i) => i >= 0);
```

This is computed on write, not on read — the Journal doesn't need to re-parse
GPX to know day structure. If the GPX has no overnight waypoints, `dayBreaks`
is an empty array (single-day route).

### D11: Journal route detail day breakdown

When a route has non-empty `dayBreaks`, the route detail page shows a day
breakdown section below the stats grid. Per-day stats (distance, ascent,
descent) are computed from the stored GPX by splitting at day-break waypoints
— reusing the same `computeDays` logic from D2, extracted into
`@trails-cool/gpx` so both Planner and Journal can use it.

```
DAY 1: Berlin → Dessau    120 km  ↑340m  ↓180m
DAY 2: Dessau → Erfurt    223 km  ↑528m  ↓490m
```

The map also colors each day segment differently (alternating two colors from
the design tokens) so users can visually see where each day starts and ends.

For single-day routes (no `dayBreaks`), nothing changes — the page renders
exactly as it does today.

### D12: computeDays as a shared package function

The `computeDays` pure function (D2) is placed in `@trails-cool/gpx` rather
than in the Planner app, since both the Planner (from Yjs + EnrichedRoute) and
the Journal (from parsed GPX) need day computation. The function signature
works with the `GpxData` tracks and waypoints returned by `parseGpx`:

```typescript
interface DayStage {
  dayNumber: number;
  startWaypointIndex: number;
  endWaypointIndex: number;
  startName?: string;
  endName?: string;
  distance: number;      // meters
  ascent: number;        // meters
  descent: number;       // meters
}

function computeDays(
  waypoints: Waypoint[],
  tracks: TrackPoint[][],
): DayStage[];
```

The Planner's `useDays()` hook maps its Yjs waypoints + EnrichedRoute into
this same shape before calling `computeDays`.

### D13: Sidebar waypoint hover highlights map marker

Hovering a waypoint row in the `WaypointSidebar` passes the waypoint index
up to `SessionView` via an `onWaypointHover` callback. `PlannerMap` receives
a `highlightedWaypoint` index and renders the corresponding marker with a
CSS `scale(1.17)` transform (0.2s ease transition). This reuses the existing
`waypointIcon` function with a `highlighted` parameter — no extra DOM
elements or Leaflet layers needed.

### D14: Journal route detail — day segment hover interaction

Hovering a day row in the route detail day breakdown triggers two effects:

1. **Map segment highlighting**: The hovered day's polyline thickens (weight 5,
   opacity 1) while other days dim (weight 2, opacity 0.3). Implemented via
   `highlightedDay` state passed to `DayColoredRoute`.

2. **Fly-to-segment**: A `FlyToSegment` component calls `map.flyToBounds()`
   on the hovered segment's bounds (200ms animation). On mouse leave it flies
   back to the full route bounds. The full route bounds are cached on first
   render to avoid recomputation.

### D15: Per-day GPX export endpoint

The existing `/api/routes/:id/gpx` endpoint gains an optional `?day=N` query
parameter. When present, it parses the stored GPX, runs `computeDays()` to
find the track point range for that day, and returns a GPX containing only
that day's track segment. The filename includes the day number
(`route_day1.gpx`).

## Risks / Trade-offs

- **Segment boundary alignment**: The day computation relies on
  `segmentBoundaries` from `EnrichedRoute` to map waypoint indices to
  coordinate ranges. If the segment merge logic changes, day computation
  breaks. Mitigate with thorough unit tests on `computeDays`.
- **Large routes**: A route with 50+ waypoints and many overnight stops could
  make the sidebar unwieldy. Collapsible sections mitigate this. We can add
  virtual scrolling later if needed.
- **Yjs backwards compatibility**: Adding `overnight` to Y.Maps is safe, but
  older clients that don't understand it will silently ignore overnight flags.
  In a collaborative session, one user could see day breakdown while another
  does not. This is acceptable for now since all clients will be updated
  together.
- **GPX round-trip**: The `<type>overnight</type>` convention is not a standard
  GPX extension namespace. Other tools will ignore it, which is fine. The data
  is not lost, just not interpreted.
