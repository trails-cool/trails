## MODIFIED Requirements

### Requirement: Route data includes geometry for rendering
Route and activity loaders SHALL return GeoJSON geometry when available.

#### Scenario: Route list returns simplified geometry
- **WHEN** the routes list loader runs
- **THEN** each route includes a `geojson` field containing the geometry as a GeoJSON string
- **AND** the geometry is simplified server-side via `ST_Simplify()` for list page performance

#### Scenario: Route detail returns full geometry
- **WHEN** the route detail loader runs and the route has geometry
- **THEN** the route includes a `geojson` field with the full-resolution GeoJSON geometry
