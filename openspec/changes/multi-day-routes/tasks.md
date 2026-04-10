## 1. Data Model & Computation

- [ ] 1.1 Add `overnight` property support to Yjs waypoint Y.Maps: helper functions `setOvernight(yjs, index, value)` and `isOvernight(yMap)` in a new `apps/planner/app/lib/overnight.ts`
- [ ] 1.2 Create `computeDays()` pure function in `packages/gpx/src/compute-days.ts`: takes `Waypoint[]` + `TrackPoint[][]`, returns `DayStage[]` (day number, waypoint range, distance, ascent, descent). Export from package index.
- [ ] 1.3 Create `useDays()` hook in `apps/planner/app/lib/use-days.ts`: maps Yjs waypoints + EnrichedRoute into `computeDays()` input, returns reactive `DayStage[]`

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

## 5. GPX Roundtrip

- [ ] 5.1 Extend `generateGpx` in `@trails-cool/gpx` to emit `<type>overnight</type>` for waypoints with `isDayBreak: true`
- [ ] 5.2 Extend `parseGpx` in `@trails-cool/gpx` to recognize `<type>overnight</type>` and set `isDayBreak: true` on parsed waypoints
- [ ] 5.3 Add multi-track export option: split track into one `<trk>` per day, each named "Day N: Start - End"

## 6. Journal Integration

- [ ] 6.1 Update `updateRoute` in `apps/journal/app/lib/routes.server.ts` to extract `dayBreaks` indices from parsed GPX waypoints and write to `dayBreaks` column
- [ ] 6.2 Expose `dayBreaks` and per-day stats in route detail loader (`routes.$id.tsx`)
- [ ] 6.3 Add day breakdown section to route detail page: per-day distance, ascent, descent, start/end names — shown only when dayBreaks is non-empty
- [ ] 6.4 Color route map segments per day (alternating colors) on the route detail map when dayBreaks exist

## 7. i18n

- [ ] 7.1 Add Planner translation keys for en + de: day labels ("Day 1", "Tag 1"), overnight toggle ("Mark as overnight stop" / "Als Übernachtung markieren"), per-day stats, route summary
- [ ] 7.2 Add Journal translation keys for en + de: day breakdown header, per-day stats labels

## 8. Testing

- [ ] 8.1 Unit tests for `computeDays()`: single day (no overnight), two days, three days, empty route, single waypoint, overnight on first/last waypoint edge cases
- [ ] 8.2 Unit tests for `overnight.ts` helpers: set/clear/check overnight on Y.Map
- [ ] 8.3 Unit tests for GPX roundtrip: generate with `isDayBreak`, parse back, verify `isDayBreak` preserved
- [ ] 8.4 Unit tests for `dayBreaks` extraction in route update logic
- [ ] 8.5 E2E test: add waypoints, toggle overnight on one, verify sidebar shows day breakdown with correct stats
- [ ] 8.6 E2E test: export GPX with day breaks, verify downloaded file contains overnight metadata
- [ ] 8.7 E2E test: save multi-day route to Journal, verify day breakdown displays on route detail page
