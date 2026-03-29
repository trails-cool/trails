## Why

The Planner shows three base tile layers (OSM, OpenTopoMap, CyclOSM) but no overlays. Route planners like brouter-web offer hillshading, waymarked trail networks, and toggleable POI layers from OpenStreetMap — information that is essential for planning multi-day bike tours and hikes. Without overlays, users must cross-reference other tools to find water sources, campsites, bike repair stations, or see official trail routes.

## What Changes

- **Tile overlays**: Add hillshading and Waymarked Trails (cycling, hiking, MTB) as toggle-able overlay layers in the Leaflet LayersControl
- **POI overlay panel**: Add a collapsible panel to toggle categories of OSM points of interest (water, shelter, camping, food, bike infrastructure, accommodation) queried from the Overpass API within the current viewport
- **POI markers**: Render POI results as categorized markers with icons, name labels, and popups showing OSM tags (opening hours, website, etc.)
- **Profile-aware defaults**: Auto-enable relevant overlays based on the active routing profile (cycling → Waymarked Cycling + bike POIs; hiking → Waymarked Hiking + water/shelter POIs)
- **Overpass client**: Shared utility for querying the Overpass API with caching, debouncing, and rate limit handling — reused by the waypoint-notes POI snap feature

## Capabilities

### New Capabilities
- `osm-tile-overlays`: Hillshading and Waymarked Trails tile overlays in the map layer switcher
- `osm-poi-overlays`: Toggleable POI categories from Overpass API rendered as map markers within the viewport

### Modified Capabilities
- `map-display`: Add overlay layers to the layer switcher alongside existing base layers
- `planner-session`: Persist enabled overlay state in Yjs so all participants see the same overlays

## Impact

- **Files**: `packages/map/src/layers.ts` (overlay tile definitions), new POI overlay components in `apps/planner/`, new Overpass client in `packages/map/` or `apps/planner/app/lib/`
- **APIs**: Overpass API (external, rate-limited — public endpoint at `overpass-api.de`)
- **Dependencies**: None new — Leaflet handles tile overlays natively, Overpass is a REST API
- **Performance**: Tile overlays are lightweight (transparent PNGs). POI overlays need viewport-scoped queries with caching to avoid excessive Overpass load.
