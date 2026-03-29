## 1. Data Model

- [ ] 1.1 Add optional `note?: string` field to `Waypoint` interface in `packages/types/src/index.ts`
- [ ] 1.2 Update `WaypointData` interface and `getWaypointsFromYjs` in `apps/planner/app/components/WaypointSidebar.tsx` to read `note` from Y.Map
- [ ] 1.3 Update `moveWaypoint` in WaypointSidebar to preserve the `note` field when reconstructing the Y.Map

## 2. Sidebar Note Display

- [ ] 2.1 Add note display below waypoint name in sidebar list item (italic, muted text, truncated to 2 lines)
- [ ] 2.2 Show "Add a note..." placeholder when note is empty (i18n key: `planner.waypoint.notePlaceholder`)
- [ ] 2.3 Add inline `<textarea>` editing: click to edit, auto-focus, auto-resize, save on blur, cancel on Escape
- [ ] 2.4 Add character counter (e.g., "127 / 500") visible during editing

## 3. Map Markers

- [ ] 3.1 Add note indicator icon on waypoint markers that have a non-empty note
- [ ] 3.2 Show note text in Leaflet tooltip on hover/tap for markers with notes

## 4. GPX Export & Import

- [ ] 4.1 Update `generateGpx` in `packages/gpx/src/generate.ts` to emit `<desc>` element when waypoint has a note
- [ ] 4.2 Update `parseGpx` in `packages/gpx/src/parse.ts` to read `<desc>` into waypoint `note` field

## 5. i18n

- [ ] 5.1 Add translation keys for note UI strings (en + de): placeholder, character counter label, tooltip "more" link
- [ ] 5.2 Add translation keys for POI types, snap action labels, and POI status messages (en + de)

## 6. Testing (Notes)

- [ ] 6.1 Unit tests: GPX generation with notes (`<desc>` output), GPX parsing with `<desc>`, character counter logic
- [ ] 6.2 E2E test: add a waypoint, type a note in sidebar, verify note persists after page interaction, verify GPX export contains note

## 7. POI Data Layer

- [ ] 7.1 Create Overpass API client in `apps/planner/app/lib/overpass.ts`: `fetchNearbyPOIs(lat, lon, radius)` function that builds an Overpass QL query, fetches from `https://overpass-api.de/api/interpreter`, and parses the JSON response into a typed `POI[]` array
- [ ] 7.2 Define `POI` interface and `POI_TYPES` constant: category (water, shelter, camping, food, viewpoint, bicycle), OSM tag mapping, icon, i18n label key. Place in `apps/planner/app/lib/poi-types.ts`
- [ ] 7.3 Build Overpass query per routing profile: filter `POI_TYPES` by the active profile (e.g., bicycle categories only for trekking/fastbike profiles) and generate the corresponding Overpass QL
- [ ] 7.4 Implement POI cache in `apps/planner/app/lib/poi-cache.ts`: `Map<string, { data: POI[]; timestamp: number }>` keyed by quantized bounding box tile, 1-hour TTL, max 50 entries, expired-on-access eviction

## 8. POI Map Display

- [ ] 8.1 Add `selectedWaypointIndex` state to PlannerMap (set when a waypoint marker is clicked or selected in sidebar)
- [ ] 8.2 Create `POIMarkers` component: receives `POI[]` and renders small circle markers colored by category, with tooltip showing POI name and type
- [ ] 8.3 Add click handler on POI markers to trigger snap (calls snap handler that updates waypoint Y.Map in a single transaction)

## 9. POI Sidebar

- [ ] 9.1 Add "Nearby" section below note area in WaypointSidebar for the selected waypoint: grouped by category, sorted by distance, max 15 items with "Show more" toggle
- [ ] 9.2 Add snap button per POI item: clicking snaps waypoint to POI coordinates, sets name, prepends note prefix (icon + type label), all in one Yjs transaction
- [ ] 9.3 Show POI loading state (spinner) and empty state ("No nearby POIs found") with appropriate i18n strings

## 10. POI Rate Limiting & Error Handling

- [ ] 10.1 Implement debounce (500ms) on waypoint selection before triggering Overpass query; abort in-flight requests via `AbortController` when selection changes
- [ ] 10.2 Handle HTTP 429 from Overpass: disable POI queries for 60 seconds, show subtle "POI lookup unavailable" message
- [ ] 10.3 Handle network errors and timeouts (10s) gracefully: fail silently, show empty POI list, no error modals

## 11. Testing (POI)

- [ ] 11.1 Unit tests for Overpass client: query construction, response parsing, error handling (mock `fetch`)
- [ ] 11.2 Unit tests for POI cache: cache hit, cache miss, TTL expiry, eviction at max entries
- [ ] 11.3 Unit tests for snap behavior: waypoint coordinates updated, name set from POI, note prefix prepended, existing note preserved
- [ ] 11.4 E2E test: select a waypoint, verify POI list appears in sidebar (mock Overpass response), click snap, verify waypoint moved and note updated
