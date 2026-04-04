## Why

The journal's route and activity pages show only text (name, distance, elevation) with no visual representation of the route. Users can't tell routes apart without clicking into each one. Every other route planning app shows a map preview — it's table-stakes UX.

The PostGIS `geom` column is already populated, and `@trails-cool/map` provides `MapView` + `RouteLayer` components. The infrastructure exists, just needs wiring up.

## What Changes

- **Route/activity list pages**: Add static map thumbnails with the route drawn, alongside existing stats
- **Route/activity detail pages**: Add interactive Leaflet map with the route displayed (read-only, uses `MapView` + `RouteLayer`)
- **Server**: Expose route geometry as GeoJSON via `ST_AsGeoJSON()` in loaders
- **Shared**: No new packages — reuse `@trails-cool/map`

## Capabilities

### New Capabilities
- `route-preview`: Map previews on journal list and detail pages (static thumbnails on lists, interactive maps on detail)

### Modified Capabilities
- `route-management`: Loaders now return GeoJSON geometry for rendering
- `map-display`: `@trails-cool/map` components used in the journal app (previously planner-only)

## Impact

- `apps/journal/app/routes/routes._index.tsx` — add map thumbnails to route cards
- `apps/journal/app/routes/routes.$id.tsx` — add interactive map to detail page
- `apps/journal/app/routes/activities._index.tsx` — add map thumbnails to activity cards
- `apps/journal/app/routes/activities.$id.tsx` — add interactive map to detail page
- `apps/journal/app/lib/routes.server.ts` — expose GeoJSON from PostGIS
- `apps/journal/app/lib/activities.server.ts` — expose GeoJSON from PostGIS
