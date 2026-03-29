## Why

The Journal currently has no way to discover routes other users have published.
Each user's route list is isolated -- you can only see your own routes. Once
route-sharing adds public visibility, there needs to be a way to actually find
those public routes. Without discovery, making a route public has no effect.

Outdoor platforms live and die by discovery. A hiker planning a trip to the
Harz Mountains should be able to pan the map there and see what routes exist.
This is the most natural interface for spatial data: a map.

## What Changes

- **Explore page**: A new `/routes/explore` page in the Journal with a full-page
  Leaflet map. Users pan and zoom to browse public routes in any area.
- **Bounding box API**: A server endpoint that takes the current map viewport
  bounds and returns public routes whose geometry intersects the bounding box,
  using PostGIS `ST_Intersects`. Results are limited to 50 and geometries are
  simplified for transfer performance.
- **Route polylines**: Public routes rendered as clickable polylines on the
  explore map. Clicking a route shows a popup with name, distance, elevation
  gain, author, and a link to the route detail page.
- **Spatial index**: Verify (or create) a GiST index on `journal.routes.geom`
  to keep bounding box queries fast.

## Capabilities

### New Capabilities

- `route-discovery`: Map-based exploration of public routes via spatial queries

### Modified Capabilities

- `journal-navigation`: Add explore link to main navigation
- `map-display`: Route polylines with interactive popups on explore map

## Non-Goals

- **Full-text search**: No searching routes by name or description. Map browsing
  is the only discovery mechanism for now.
- **Filtering**: No filtering by distance, elevation, activity type, difficulty,
  or tags. These are useful but add complexity -- defer until real users ask.
- **Recommendations**: No "routes you might like" or personalized suggestions.
- **Clustering**: No marker clustering for dense areas. The 50-result limit and
  geometry simplification keep the map readable. Clustering can come later.
- **Federated discovery**: Routes from other Journal instances are out of scope.
  This only covers routes on the local instance.

## Dependencies

- **route-sharing** (route-features change, section 1): The `visibility` column
  on `journal.routes` must exist before this change can query for public routes.
  Without it, there are no public routes to discover.

## Impact

- **Database**: GiST spatial index on `journal.routes.geom` (may already exist)
- **New route**: `/routes/explore` page + API endpoint
- **Navigation**: Explore link added to Journal nav
- **Packages**: Uses `@trails-cool/map` (MapView, RouteLayer) -- may need a new
  component for interactive route polylines with popups
- **i18n**: New keys for explore page UI (en + de)
