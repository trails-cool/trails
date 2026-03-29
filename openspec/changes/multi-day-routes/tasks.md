## 1. Data Model & Computation

- [ ] 1.1 Add `overnight` property support to Yjs waypoint Y.Maps: helper functions `setOvernight(yjs, index, value)` and `isOvernight(yMap)` in a new `apps/planner/app/lib/overnight.ts`
- [ ] 1.2 Create `apps/planner/app/lib/compute-days.ts` with `computeDays()` pure function: takes waypoints array + `EnrichedRoute`, returns `DayStage[]` (day number, waypoint range, coord range, distance, ascent, descent, estimated time)
- [ ] 1.3 Create `useDays()` hook in `apps/planner/app/lib/use-days.ts`: observes Yjs waypoints + routeData, calls `computeDays()`, returns reactive `DayStage[]`

## 2. Sidebar Day Breakdown

- [ ] 2.1 Create `DayBreakdown` component: renders collapsible day sections with per-day stats (distance, ascent, estimated time), Day 1 expanded by default
- [ ] 2.2 Add overnight toggle button (moon icon) to each waypoint row in `WaypointSidebar` — amber styling when active, calls `setOvernight()`
- [ ] 2.3 Integrate `DayBreakdown` into `WaypointSidebar`: show day-grouped view when any waypoint has overnight, flat list otherwise
- [ ] 2.4 Add route summary header to sidebar: total distance, ascent, number of days (e.g. "Berlin -> Erfurt  343 km  ^868m  2 days")

## 3. Map Integration

- [ ] 3.1 Add overnight marker variant to `PlannerMap`: amber-brown circle (`--stop` token) for overnight waypoints, replacing default olive marker
- [ ] 3.2 Add day label DivIcon markers on route at day boundaries: white pill with "Day N . X km" text, positioned at overnight waypoint coordinates
- [ ] 3.3 Add right-click context menu on waypoint markers with "Mark as overnight stop" / "Remove overnight stop" option

## 4. Elevation Chart

- [ ] 4.1 Add day divider rendering to `ElevationChart`: dashed vertical lines at overnight waypoint distances with "Day N" labels at top
- [ ] 4.2 Show per-day distance ranges on x-axis labels (e.g. "120 km" at each day boundary)

## 5. GPX Export

- [ ] 5.1 Extend `generateGpx` in `@trails-cool/gpx` to emit `<type>overnight</type>` for waypoints with `isDayBreak: true`
- [ ] 5.2 Add multi-track export option: split track into one `<trk>` per day, each named "Day N: Start - End"

## 6. i18n

- [ ] 6.1 Add translation keys for en + de: day labels ("Day 1", "Tag 1"), overnight toggle ("Mark as overnight stop" / "Als Ubernachtung markieren"), per-day stats, route summary

## 7. Testing

- [ ] 7.1 Unit tests for `computeDays()`: single day (no overnight), two days, three days, empty route, single waypoint, overnight on first/last waypoint edge cases
- [ ] 7.2 Unit tests for `overnight.ts` helpers: set/clear/check overnight on Y.Map
- [ ] 7.3 Unit tests for GPX export with overnight waypoints: verify `<type>overnight</type>` output, multi-track splitting
- [ ] 7.4 E2E test: add waypoints, toggle overnight on one, verify sidebar shows day breakdown with correct stats
- [ ] 7.5 E2E test: export GPX with day breaks, verify downloaded file contains overnight metadata
