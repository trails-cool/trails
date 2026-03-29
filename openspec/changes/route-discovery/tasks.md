## 1. Spatial Index & Database

- [ ] 1.1 Verify whether a GiST index exists on `journal.routes.geom` -- if not, create one via raw SQL migration: `CREATE INDEX IF NOT EXISTS idx_routes_geom ON journal.routes USING GIST (geom);`
- [ ] 1.2 Verify the `visibility` column exists on `journal.routes` (dependency on route-sharing) -- if not, note this as a blocker

## 2. Bounding Box API

- [ ] 2.1 Create `apps/journal/app/routes/api.routes.explore.ts` with a GET loader that accepts `south`, `west`, `north`, `east` query params, validates bounds, and returns public routes within the bounding box using `ST_Intersects` + `ST_Simplify(geom, 0.001)`, limited to 50 results
- [ ] 2.2 Join route owner to include `username` and `displayName` in response
- [ ] 2.3 Register the API route in `apps/journal/app/routes.ts`: `route("api/routes/explore", "routes/api.routes.explore.ts")`

## 3. Explore Page

- [ ] 3.1 Create `apps/journal/app/routes/routes.explore.tsx` with a full-page `MapView` from `@trails-cool/map`, filling the viewport below the nav bar
- [ ] 3.2 Register the page route in `apps/journal/app/routes.ts`: `route("routes/explore", "routes/routes.explore.tsx")` (before the `routes/:id` route to avoid param conflict)
- [ ] 3.3 Create `useExploreRoutes` hook: listens to Leaflet `moveend`, debounces 300ms, fetches `/api/routes/explore` with current viewport bounds, returns `{ routes, isLoading }`. Use AbortController to cancel in-flight requests.
- [ ] 3.4 Add simple bounds-based cache (Map with max 20 entries) to `useExploreRoutes` to avoid re-fetching previously viewed areas
- [ ] 3.5 Store and restore last map center/zoom in localStorage so the explore page remembers the user's last viewport

## 4. Route Rendering & Interaction

- [ ] 4.1 Create `ExploreRouteLayer` component in `@trails-cool/map`: renders an array of route objects as Leaflet polylines with hover highlighting (opacity 0.6 -> 0.9, weight 3 -> 5)
- [ ] 4.2 Add click handler to each polyline that opens a Leaflet popup with route name (linked to `/routes/:id`), formatted distance, elevation gain, and author name (linked to `/users/:username`)
- [ ] 4.3 Export `ExploreRouteLayer` from `@trails-cool/map` package index

## 5. Navigation

- [ ] 5.1 Add "Explore" link to Journal navigation bar, pointing to `/routes/explore`

## 6. Performance

- [ ] 6.1 Add loading indicator (small spinner in map corner) shown during API fetches, without clearing existing routes from the map
- [ ] 6.2 Verify query performance with `EXPLAIN ANALYZE` on the bounding box query with the GiST index -- should use index scan, not sequential scan

## 7. i18n

- [ ] 7.1 Add translation keys (en + de) for: explore page title ("Explore Routes" / "Routen entdecken"), loading indicator, popup labels (distance, elevation, author), empty state ("No public routes in this area" / "Keine offentlichen Routen in diesem Bereich"), nav link

## 8. Testing

- [ ] 8.1 Unit test for bounding box API loader: mock database, verify correct SQL parameters, response format, 50-result limit, handling of missing/invalid bounds
- [ ] 8.2 Unit test for `useExploreRoutes` hook: verify debouncing, abort behavior, cache hit/miss
- [ ] 8.3 E2E test: navigate to `/routes/explore`, verify map renders, pan the map, verify routes appear as polylines (requires seeded public routes with geometry in test database)
