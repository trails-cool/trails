## ADDED Requirements

### Requirement: Map-based route exploration
The Journal SHALL provide an explore page with a full-page map for browsing public routes by location.

#### Scenario: Browse public routes
- **WHEN** a user visits `/routes/explore`
- **THEN** a full-page Leaflet map is displayed
- **AND** public routes within the current viewport are shown as clickable polylines

#### Scenario: Route popup
- **WHEN** a user clicks a route polyline on the explore map
- **THEN** a popup shows the route name, distance, elevation gain, author, and a link to the detail page

### Requirement: Bounding box spatial query
The Journal SHALL provide an API endpoint for querying public routes by map viewport bounds.

#### Scenario: Viewport query
- **WHEN** the map viewport changes
- **THEN** the client requests routes intersecting the current bounds via PostGIS `ST_Intersects`
- **AND** results are limited to 50 routes with simplified geometries

### Requirement: Spatial index
The routes table SHALL have a GiST index on the geometry column for fast bounding box queries.

#### Scenario: Index exists
- **WHEN** the database is set up
- **THEN** a GiST index on `journal.routes.geom` supports efficient spatial queries
