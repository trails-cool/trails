## 1. Data Model

- [x] 1.1 Add optional `note?: string` field to `Waypoint` interface in `packages/types/src/index.ts`
- [x] 1.2 Read `note` from Y.Map in `WaypointSidebar.tsx` (add to `WaypointData` interface and the mapping loop)
- [x] 1.3 Preserve `note` when reconstructing the Y.Map in `moveWaypoint` (WaypointSidebar)

## 2. Sidebar Note Display

- [x] 2.1 Add note display below waypoint name in sidebar list item (italic, muted text, truncated to 2 lines)
- [x] 2.2 Show "Add a note..." placeholder when note is empty (i18n key: `planner.waypoint.notePlaceholder`)
- [x] 2.3 Add inline `<textarea>` editing: click to edit, auto-focus, auto-resize, save on blur, cancel on Escape
- [x] 2.4 Add character counter (e.g., "127 / 500") visible during editing

## 3. Map Markers

- [x] 3.1 Add note indicator icon on waypoint markers that have a non-empty note
- [x] 3.2 Show note text in Leaflet tooltip on hover/tap for markers with notes

## 4. GPX Export & Import

- [x] 4.1 Emit `<desc>` on `<wpt>` in `generateGpx` when waypoint has a note (note: route-level `<desc>` already exists in `<metadata>`, this is per-waypoint)
- [x] 4.2 Read `<desc>` inside `<wpt>` into waypoint `note` field in `parseWaypoints` (note: `metadata > desc` is already parsed separately)

## 5. i18n

- [x] 5.1 Add translation keys for note UI strings (en + de): `planner.waypoint.notePlaceholder`, character counter label, Escape cancel hint
- [x] 5.2 Add translation keys for POI snap action labels and nearby POI status messages (en + de) — POI type labels already exist in `@trails-cool/map-core`

## 6. Testing (Notes)

- [x] 6.1 Unit tests: per-waypoint `<desc>` in GPX generation; `<desc>` inside `<wpt>` parsed into `note`; verify no collision with `metadata > desc`
- [x] 6.2 E2E test: type a note in sidebar, blur, verify note persists; verify GPX export contains `<desc>` inside `<wpt>`

## 7. POI Data Layer (per-waypoint)

- [x] 7.1 Overpass client (`overpass.ts`), proxy endpoint, `buildQuery`, `parseResponse` — already shipped
- [x] 7.2 `Poi` interface and category definitions — in `overpass.ts` + `@trails-cool/map-core`
- [x] 7.3 Overpass query building per routing profile — already in `buildQuery`
- [x] 7.4 POI cache (`poi-cache.ts`) with quantized bbox, TTL, eviction — already shipped
- [x] 7.5 Add `fetchNearbyPois(lat, lon, radiusMeters, categories)` to `overpass.ts`: constructs a ~500m bbox from a single coordinate and reuses `buildQuery` + the existing `/api/overpass` proxy

## 8. POI Map Display

- [x] 8.1 Add `selectedWaypointIndex` state lifted to `SessionView` (or passed via callback from `WaypointSidebar` → `PlannerMap`)
- [x] 8.2 Create `NearbyPoiMarkers` component: receives `Poi[]` for the selected waypoint + renders small circle markers by category with name tooltip — distinct from the overlay `PoiLayer` markers
- [x] 8.3 Wire click on `NearbyPoiMarkers` to call snap handler

## 9. POI Sidebar

- [x] 9.1 Add "Nearby" section in `WaypointSidebar` for the selected waypoint: call `fetchNearbyPois`, show spinner / empty state, list POIs sorted by distance (max 15, "Show more" toggle)
- [x] 9.2 Snap button per POI: move waypoint coords, set name from POI (if waypoint unnamed), prepend `"<icon> <type>"` to note — all in one Yjs transaction via `use-waypoint-manager`
- [x] 9.3 Debounce POI fetch 500ms after waypoint selection; cancel in-flight fetch via `AbortController` when selection changes

## 10. POI Rate Limiting & Error Handling

- [x] 10.1 Handle HTTP 429 from nearby-POI fetch: suppress for 60s, show subtle "POI lookup unavailable" notice in the Nearby section
- [x] 10.2 Handle network errors and 10s timeout: fail silently, show empty Nearby list — no error modals

## 11. Testing (POI)

- [x] 11.1 Overpass client unit tests (query construction, response parsing) — `overpass.test.ts` already covers this
- [x] 11.2 POI cache unit tests — `poi-cache.test.ts` already covers this
- [x] 11.3 Unit tests for `fetchNearbyPois`: correct bbox from lat/lon/radius, category filtering
- [x] 11.4 Unit tests for snap: coords updated, name set, note prefix prepended, existing note preserved, all in one Yjs transaction
- [x] 11.5 E2E test: mock Overpass via route handler, select a waypoint, verify Nearby list appears, click snap, verify waypoint moved and note prefixed
