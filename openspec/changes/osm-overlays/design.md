## Context

The Planner currently has three base tile layers (OSM, OpenTopoMap, CyclOSM) in
`packages/map/src/layers.ts`, rendered via Leaflet's `LayersControl`. There are
no overlay layers and no POI display. brouter-web offers hillshading, Waymarked
Trails networks, and ~60 Overpass-powered POI categories — a model worth
adopting selectively.

The Planner is stateless (Yjs CRDT), collaborative, and uses BRouter for
routing. Overlay state should sync across participants.

## Goals / Non-Goals

**Goals:**
- Add tile-based overlays (hillshading, waymarked trails) to the layer switcher
- Add viewport-scoped POI overlays from Overpass API with per-category toggling
- Auto-suggest relevant overlays based on routing profile
- Build a reusable Overpass client shared with waypoint-notes POI snap

**Non-Goals:**
- Custom tile server or self-hosted overlays (use public tile services)
- Full brouter-web layer catalog (50+ layers, most country-specific)
- Offline/cached tile data
- Vector tile overlays (MVT) — stick with raster for now
- POI editing or contributing back to OSM

## Decisions

### D1: Tile overlay definitions

Add an `overlayLayers` export to `packages/map/src/layers.ts` alongside
existing `baseLayers`. Each overlay is a transparent tile layer rendered on top
of the base layer.

Initial overlays:

| Id | Name | URL | Attribution |
|----|------|-----|-------------|
| `hillshading` | Hillshading | `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png` via [Leaflet.TileLayer.Terrarium](https://github.com/pka/leaflet-terrarium-hillshading) or pre-rendered from `https://tiles.wmflabs.org/hillshading/{z}/{x}/{y}.png` | SRTM/Mapzen |
| `waymarked-cycling` | Cycling Routes | `https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png` | Waymarked Trails (CC-BY-SA) |
| `waymarked-hiking` | Hiking Routes | `https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png` | Waymarked Trails (CC-BY-SA) |
| `waymarked-mtb` | MTB Routes | `https://tile.waymarkedtrails.org/mtb/{z}/{x}/{y}.png` | Waymarked Trails (CC-BY-SA) |

These are all free, public tile endpoints used by brouter-web and other OSM
tools. No API keys needed.

**Alternative considered**: Thunderforest Outdoors or OpenCycleMap — requires
API key, limited free tier. Not worth the complexity.

### D2: Overlay toggle in LayersControl

Leaflet's `LayersControl` already supports overlays natively via
`LayersControl.Overlay` (react-leaflet). Add overlay tile layers as checkboxes
alongside the existing base layer radio buttons. No custom UI needed for Phase 1.

### D3: POI category system

Define POI categories as a typed configuration mapping OSM tags to display
properties. Inspired by brouter-web's `layers/overpass/` structure but
simplified to the categories most relevant for route planning:

```typescript
interface PoiCategory {
  id: string;
  name: string;           // i18n key
  icon: string;           // emoji or SVG icon id
  color: string;          // marker color
  query: string;          // Overpass QL fragment, e.g. "nwr[amenity=drinking_water]"
  profiles?: string[];    // routing profiles where this is auto-enabled
}
```

**Initial categories** (curated from brouter-web's full list):

| Category | POI types (OSM tags) | Icon | Auto-enable for |
|----------|---------------------|------|-----------------|
| Drinking water | `amenity=drinking_water`, `amenity=water_point` | 💧 | all |
| Shelter | `amenity=shelter`, `tourism=wilderness_hut` | 🛖 | hiking |
| Camping | `tourism=camp_site`, `tourism=caravan_site`, `tourism=picnic_site` | ⛺ | all |
| Food & drink | `amenity=restaurant`, `amenity=cafe`, `amenity=fast_food`, `amenity=pub`, `amenity=biergarten` | 🍽️ | — |
| Groceries | `shop=supermarket`, `shop=convenience`, `shop=bakery` | 🛒 | — |
| Bike infrastructure | `amenity=bicycle_parking`, `amenity=bicycle_repair_station`, `amenity=bicycle_rental` | 🔧 | cycling |
| Accommodation | `tourism=hotel`, `tourism=hostel`, `tourism=guest_house` | 🏨 | — |
| Viewpoints | `tourism=viewpoint` | 👁️ | hiking |
| Toilets | `amenity=toilets` | 🚻 | — |

**Not included** (from brouter-web but too niche): ATMs, banks, benches,
telephones, kneipp water cures, car parking, railway stations, art galleries,
museums, ice cream shops, BBQs. Can be added later by extending the config.

### D4: Overpass client

Create `apps/planner/app/lib/overpass.ts` with:

- `queryPois(bbox, categories): Promise<Poi[]>` — builds Overpass QL query
  combining all enabled categories into one request (union query), returns
  parsed GeoJSON features
- **Bbox query**: `[bbox:south,west,north,east]` in Overpass QL, scoped to
  current Leaflet viewport
- **Endpoint**: `https://overpass-api.de/api/interpreter` (public, no key)
- **Response format**: Request `[out:json]` for easier parsing than XML
- **Deduplication**: Overpass may return same node via multiple tags — dedup by
  OSM id

This client is also used by the waypoint-notes POI snap feature (smaller radius
query around a single waypoint).

### D5: POI caching and rate limiting

Overpass API is public and rate-limited. Must be respectful:

- **Debounce**: 500ms after map `moveend` before querying
- **Abort**: Cancel in-flight requests when viewport changes (AbortController)
- **Tile-based caching**: Quantize viewport to grid tiles (e.g., 0.1° cells),
  cache results per tile. Reuse cached tiles that overlap new viewport.
- **TTL**: 10 minutes for cached tiles (POI data changes slowly)
- **Max concurrent**: 1 request at a time
- **429 handling**: Exponential backoff, disable auto-refresh temporarily, show
  "POI data unavailable" message
- **Zoom threshold**: Only query POIs at zoom >= 12 (avoids massive result sets
  at country-level zoom)

### D6: POI overlay panel

A collapsible panel (not the LayersControl — too many items) for toggling POI
categories. Positioned below the layer switcher on the right side of the map.

- Toggle button with POI icon to open/close
- Checkbox per category with icon and name
- "Loading..." indicator while Overpass query is in flight
- Category count badge showing number of visible POIs
- Panel state (which categories are enabled) synced via Yjs so all participants
  see the same POIs

### D7: POI marker rendering

- Use Leaflet `L.Marker` with `L.DivIcon` for each POI (not CircleMarker —
  need icons)
- Icon shows the category emoji/icon at 20×20px
- Popup on click showing: name, category, opening hours (if available), website
  link (if available), OSM link
- **Clustering**: Use `leaflet.markercluster` at low zoom levels to avoid
  thousands of markers. Cluster by category color.
- **Z-index**: POI markers below route and waypoint markers

### D8: Profile-aware overlay defaults

When the routing profile changes (via Yjs `routeOptions.profile`), suggest
relevant overlays:

- **Cycling profiles** (cycling-safe, cycling-fast, etc.): Auto-enable
  Waymarked Cycling overlay + Bike infrastructure POIs
- **Hiking profiles**: Auto-enable Waymarked Hiking + Shelter + Viewpoints
- **MTB profiles**: Auto-enable Waymarked MTB + Bike infrastructure

"Auto-enable" means toggling on when profile changes, not forcing — users can
still disable. Only auto-enable on profile change, not on page load (respect
user's previous choice stored in Yjs).

### D9: Yjs overlay state

Store enabled overlays in Yjs `routeOptions` Y.Map:

```
routeOptions.overlays = ["hillshading", "waymarked-cycling"]
routeOptions.poiCategories = ["drinking_water", "camping", "bike_infra"]
```

Array of string IDs. Changes sync to all participants. Persisted in crash
recovery localStorage snapshot.

### D10: POI-to-waypoint integration

POIs can become waypoints through three paths, all using the same snap logic:

1. **"Add as waypoint" button** in POI popup → appends to end of route
2. **Click near a POI** (within 50m) → new waypoint snaps to POI position
3. **Drag waypoint near a POI** → snaps on drop, clears name if dragged away

When snapping, the waypoint's Yjs Y.Map stores:
- `osmId`: OSM node ID for future cross-referencing
- `poiTags`: Key tags (phone, address, website, opening hours, amenity type)

This metadata persists through Yjs and will be available for Journal display.

### D11: Overpass endpoint fallback

Primary endpoint is `overpass.kumi.systems` (higher rate limits, same as
brouter-web). Falls back to `overpass-api.de` if the primary fails. The
Overpass API sometimes returns rate limit errors as HTTP 200 with
"rate_limited" in the body — the client checks for this pattern.

### D12: Z-index layering

Marker z-index offsets centralized in `apps/planner/app/lib/z-index.ts`:
- Cursors (-1000) < Ghost waypoint (-100) < Waypoints (1000) <
  Waypoint highlighted (1200) < POI markers (1500) < Highlight dot (2000)

## Risks / Trade-offs

- **Overpass API availability**: Public endpoint, no SLA. If down, POI overlays
  fail gracefully (show message, tile overlays still work). Fallback endpoint
  (`overpass.kumi.systems` → `overpass-api.de`) implemented.
- **Tile service availability**: Waymarked Trails and hillshading tiles are
  community-run. → Degrade gracefully if tiles 404. Consider self-hosting tiles
  if usage grows.
- **Performance with many POIs**: Dense areas (cities) may return hundreds of
  POIs. → Zoom threshold (>=10) + 100 element limit mitigate this. Marker
  clustering deferred — can add later if density becomes an issue.
- **Overpass query cost**: Combining many categories into one query is efficient
  but returns large payloads. → Only query enabled categories, not all. 1MB
  maxsize limit, 10s timeout.
- **Routing rate limit**: Multi-waypoint routes with POI snapping can trigger
  rapid recomputes. Increased rate limit from 60 to 300/hour to accommodate.
