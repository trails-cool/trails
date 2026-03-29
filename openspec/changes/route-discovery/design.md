## Context

Routes in the Journal store geometry as PostGIS `LineString(4326)` in the
`journal.routes.geom` column (see `packages/db/src/schema/journal.ts`). The
`@trails-cool/map` package provides `MapView` (Leaflet map with layer controls)
and `RouteLayer` (GeoJSON polyline rendering). The route-features change adds a
`visibility` column to routes, enabling public/private distinction. This change
builds on all of that to let users discover public routes by browsing a map.

The existing route-features tasks.md (section 4) sketches spatial search in five
bullet points. This change breaks it out into a standalone, fully specified
implementation plan.

## Goals / Non-Goals

**Goals:**
- Full-page map at `/routes/explore` for browsing public routes
- Efficient PostGIS bounding box queries with spatial indexing
- Clickable route polylines with preview popups
- Debounced viewport-based fetching with result caching

**Non-Goals:**
- Text search, filtering, sorting, recommendations
- Sidebar with route list (map-only for v1)
- Federated route discovery across instances
- Route clustering for dense areas

## Decisions

### D1: Explore page -- full-page Leaflet map

The explore page at `/routes/explore` renders a full-page `MapView` from
`@trails-cool/map` with no sidebar or list panel. The map fills the viewport
below the navigation bar. This is the simplest useful interface and avoids
premature layout decisions.

The page is accessible to all users (including unauthenticated visitors) since
it only shows public routes. The initial map center and zoom come from the
user's last position (stored in localStorage) or fall back to the default
center (Europe overview, `[50.1, 10.0]` zoom 6).

Route: `route("routes/explore", "routes/routes.explore.tsx")` added to
`apps/journal/app/routes.ts`.

### D2: Bounding box query API

A new API route at `GET /api/routes/explore` accepts the map viewport as query
parameters and returns public routes within the bounds:

```
GET /api/routes/explore?south=47.2&west=5.8&north=55.1&east=15.0
```

The server query:

```sql
SELECT id, name, distance, elevation_gain, owner_id,
       ST_AsGeoJSON(ST_Simplify(geom, 0.001)) AS geom_json
FROM journal.routes
WHERE visibility = 'public'
  AND geom IS NOT NULL
  AND ST_Intersects(
    geom,
    ST_MakeEnvelope(:west, :south, :east, :north, 4326)
  )
ORDER BY distance DESC NULLS LAST
LIMIT 50;
```

Key decisions:
- **`ST_Intersects`** over `ST_Within`: routes that cross the viewport boundary
  should still appear, not just routes fully contained.
- **`ST_Simplify(geom, 0.001)`**: Simplify geometries for transfer (~100m
  tolerance at European latitudes). The explore map doesn't need full-resolution
  tracks -- users click through to the detail page for that.
- **Limit 50**: Prevents overwhelming the map and keeps response times fast.
  Ordered by distance descending so longer (likely more interesting) routes
  appear first when the limit is hit.
- **Owner join**: Include owner username and display name for the popup author
  attribution.

Response format:

```json
{
  "routes": [
    {
      "id": "abc123",
      "name": "Berlin to Prague",
      "distance": 343000,
      "elevationGain": 1240,
      "author": { "username": "ullrich", "displayName": "Ullrich" },
      "geometry": { "type": "LineString", "coordinates": [...] }
    }
  ]
}
```

### D3: Route rendering with interactive popups

Public routes are rendered as polylines on the explore map. Each route is a
clickable Leaflet polyline. Clicking opens a Leaflet popup showing:

- Route name (linked to `/routes/:id`)
- Distance (formatted: "343 km")
- Elevation gain (formatted: "+1,240 m")
- Author name (linked to `/users/:username`)

This requires a new component in `@trails-cool/map` -- an `ExploreRouteLayer`
that takes an array of route objects and renders them as interactive polylines.
Unlike the existing `RouteLayer` (which renders a single GeoJSON object), this
component manages multiple routes with distinct click handlers.

Styling:
- Default: blue polyline (`#2563eb`, weight 3, opacity 0.6)
- Hover: increase opacity to 0.9 and weight to 5
- Active (popup open): keep highlighted styling

### D4: Spatial index verification

The `journal.routes.geom` column uses `geometry(LineString, 4326)`. PostGIS
does not automatically create a spatial index. A GiST index is required for
`ST_Intersects` to perform well:

```sql
CREATE INDEX IF NOT EXISTS idx_routes_geom ON journal.routes USING GIST (geom);
```

This should be added as a Drizzle migration or verified to already exist. If
using Drizzle's `db:push`, the index needs to be added via a custom SQL
migration since Drizzle ORM does not natively support GiST index declarations
on custom types.

### D5: Debounced viewport fetching

The explore page fetches routes when the map viewport changes (Leaflet
`moveend` event). To avoid excessive API calls during panning and zooming:

- **Debounce 300ms**: Wait 300ms after the last `moveend` before fetching.
- **Abort previous**: Cancel in-flight requests when a new fetch starts
  (AbortController).
- **Cache by bounds**: Store the last response keyed by rounded bounds. If the
  user pans back to a previously viewed area, serve from cache. Simple
  Map-based cache with a max of 20 entries (LRU eviction).
- **Loading state**: Show a subtle loading indicator (spinner in map corner)
  during fetches. Don't clear existing routes while loading -- overlay new
  results when they arrive.

This logic lives in a custom hook: `useExploreRoutes(map)` that returns
`{ routes, isLoading }`.

### D6: Dependency on route-sharing

This change cannot function without the `visibility` column on
`journal.routes`. The bounding box query filters on `visibility = 'public'`.
If the column doesn't exist, the query fails.

Implementation order: route-sharing schema changes (route-features section 1)
must be completed first. The explore page can be built in parallel but only
tested after visibility exists and at least one route is set to public.

## Risks / Trade-offs

- **50-result limit may frustrate users**: In dense areas (Alps, popular hiking
  regions) many routes could exist. The limit means some routes are invisible.
  Mitigate by ordering by distance (longer routes first) and noting this is v1.
  Clustering or pagination can come later.
- **Geometry simplification may look rough**: `ST_Simplify(geom, 0.001)` is
  aggressive. At the explore zoom level this is fine, but if a user zooms in
  close, simplified routes look jagged. Acceptable because clicking opens the
  detail page with full geometry.
- **No spatial index in Drizzle**: Drizzle doesn't support GiST indexes on
  custom types declaratively. The index must be managed via raw SQL migration.
  This is a minor operational concern, not a technical risk.
- **Unauthenticated access**: The explore endpoint is public. This is
  intentional (discovery should not require login) but means rate limiting
  should be considered to prevent abuse.
