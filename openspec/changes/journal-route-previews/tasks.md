## 1. Server — Expose GeoJSON

- [x] 1.1 Add `geojsonFromGeom()` helper using `ST_AsGeoJSON(geom)` to convert PostGIS geometry to GeoJSON string
- [x] 1.2 Update `listRoutes()` to return simplified GeoJSON per route via `ST_AsGeoJSON(ST_Simplify(geom, 0.001))`
- [x] 1.3 Update `getRoute()` to return full-resolution GeoJSON
- [x] 1.4 Update `listActivities()` to return simplified GeoJSON per activity
- [x] 1.5 Update `getActivity()` to return full-resolution GeoJSON

## 2. Route List Page — Map Thumbnails

- [x] 2.1 Create `RouteMapThumbnail` component: small MapView + RouteLayer, no controls, auto-fit bounds
- [x] 2.2 Add thumbnail to each route card in `routes._index.tsx` (lazy-loaded via Suspense)
- [x] 2.3 Show placeholder when route has no geometry

## 3. Activity List Page — Map Thumbnails

- [x] 3.1 Add thumbnail to each activity card in `activities._index.tsx` (reuse `RouteMapThumbnail`)
- [x] 3.2 Show placeholder when activity has no geometry

## 4. Route Detail Page — Interactive Map

- [x] 4.1 Add full-width MapView + RouteLayer to `routes.$id.tsx`, auto-fit bounds
- [x] 4.2 Skip map section when route has no geometry

## 5. Activity Detail Page — Interactive Map

- [x] 5.1 Add full-width MapView + RouteLayer to `activities.$id.tsx`, auto-fit bounds
- [x] 5.2 Skip map section when activity has no geometry

## 6. i18n

- [x] 6.1 Add translation keys for map placeholder text (en + de)

## 7. Testing

- [x] 7.1 E2E: route detail page shows map when route has geometry
- [x] 7.2 E2E: route list page renders without errors
