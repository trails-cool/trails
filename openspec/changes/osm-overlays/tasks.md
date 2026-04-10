## 1. Tile Overlay Definitions

- [x] 1.1 Add `overlayLayers` export to `packages/map/src/layers.ts` with hillshading, Waymarked Cycling, Waymarked Hiking, Waymarked MTB tile configs
- [x] 1.2 Add `LayersControl.Overlay` entries in `MapView.tsx` and `PlannerMap.tsx` for each overlay
- [x] 1.3 Verify overlay attribution updates correctly when toggling overlays on/off

## 2. Overlay State Sync

- [ ] 2.1 Add `overlays` string array to Yjs `routeOptions` Y.Map for enabled tile overlay IDs
- [ ] 2.2 Add `poiCategories` string array to Yjs `routeOptions` Y.Map for enabled POI category IDs
- [ ] 2.3 Sync LayersControl state with Yjs — toggling overlay updates Yjs, Yjs changes toggle layers
- [ ] 2.4 Include overlay state in crash recovery localStorage snapshot

## 3. Overpass Client

- [x] 3.1 Create `apps/planner/app/lib/overpass.ts` with `queryPois(bbox, categories)` function
- [x] 3.2 Build Overpass QL union queries from enabled POI category configs
- [x] 3.3 Parse `[out:json]` response into typed `Poi` objects (id, lat, lon, name, category, tags)
- [x] 3.4 Deduplicate results by OSM node ID (same node may match multiple tag queries)

## 4. POI Caching & Rate Limiting

- [x] 4.1 Implement tile-based cache: quantize viewport to 0.1° grid cells, cache per cell with 10-minute TTL
- [x] 4.2 Add 500ms debounce on map `moveend` before triggering Overpass query
- [x] 4.3 Use AbortController to cancel in-flight requests when viewport changes
- [x] 4.4 Handle 429 responses with exponential backoff and user-visible message
- [x] 4.5 Enforce zoom >= 12 threshold — show "Zoom in to see POIs" message below

## 5. POI Category Configuration

- [x] 5.1 Define `PoiCategory` type and initial category configs (water, shelter, camping, food, groceries, bike infra, accommodation, viewpoints, toilets)
- [x] 5.2 Map each category to Overpass QL tag queries, icon, color, and applicable routing profiles

## 6. POI Overlay Panel

- [ ] 6.1 Create collapsible POI panel component with toggle button (map right side, below layer switcher)
- [ ] 6.2 Render checkbox per POI category with icon, name, and visible count badge
- [ ] 6.3 Show loading indicator while Overpass query is in flight
- [ ] 6.4 Show empty/error states (no results, Overpass unavailable, zoom too low)

## 7. POI Marker Rendering

- [ ] 7.1 Render POI markers using `L.Marker` with `L.DivIcon` showing category icon
- [ ] 7.2 Add click popup with POI name, category, opening hours, website, and OSM link
- [ ] 7.3 Add `leaflet.markercluster` for clustering dense POI areas (dynamic import to avoid bundle bloat)
- [ ] 7.4 Set z-index so POI markers render below route polyline and waypoint markers

## 8. Profile-Aware Defaults

- [ ] 8.1 Define profile-to-overlay mapping (cycling → waymarked-cycling + bike POIs, hiking → waymarked-hiking + shelter + viewpoints, MTB → waymarked-mtb + bike POIs)
- [ ] 8.2 Auto-enable mapped overlays on routing profile change (update Yjs arrays)
- [ ] 8.3 Only auto-enable on explicit profile change, not on initial page load (respect existing Yjs state)

## 9. i18n

- [ ] 9.1 Add translation keys for all overlay names, POI category names, and UI strings (en + de)

## 10. Testing

- [ ] 10.1 Unit tests for Overpass client: query building, response parsing, deduplication
- [ ] 10.2 Unit tests for POI cache: tile quantization, TTL expiry, cache hit/miss
- [ ] 10.3 Unit tests for profile-to-overlay mapping
- [ ] 10.4 E2E test: enable hillshading overlay, verify tile requests
- [ ] 10.5 E2E test: enable POI category, verify markers appear (mock Overpass response)
