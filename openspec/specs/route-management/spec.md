## Purpose

Route CRUD operations, GPX import/export, sequential versioning, PostGIS spatial storage, and route metadata in the Journal app.

## Requirements

### Requirement: Create route
The Journal SHALL allow authenticated users to create a new route with a name and optional description.

#### Scenario: Create empty route
- **WHEN** a user clicks "New Route" and enters a name
- **THEN** a new route record is created in PostgreSQL and the user is redirected to the route detail page

### Requirement: View route
The Journal SHALL display route details including map, metadata, and elevation stats.

#### Scenario: View route detail
- **WHEN** a user navigates to a route's URL
- **THEN** they see the route name, description, a map with the route polyline, distance, and elevation gain/loss

### Requirement: Update route
The Journal SHALL allow the route owner to update the route name, description, and GPX.

#### Scenario: Update route metadata
- **WHEN** a route owner edits the route name or description and saves
- **THEN** the route record is updated and a new version is created

### Requirement: Delete route
The Journal SHALL allow the route owner to delete a route.

#### Scenario: Delete route with confirmation
- **WHEN** a route owner clicks "Delete" and confirms
- **THEN** the route and all its versions are permanently deleted

### Requirement: GPX import
The Journal SHALL allow users to create or update a route by uploading a GPX file.

#### Scenario: Import GPX as new route
- **WHEN** a user uploads a GPX file on the "Import" page
- **THEN** a new route is created with waypoints and track parsed from the GPX, and route geometry is stored in PostGIS

#### Scenario: Import GPX to existing route
- **WHEN** a route owner uploads a GPX file on an existing route's page
- **THEN** the route GPX is replaced and a new version is created

### Requirement: GPX export
The Journal SHALL allow users to download any route as a GPX file.

#### Scenario: Export route as GPX
- **WHEN** a user clicks "Export GPX" on a route detail page
- **THEN** a GPX file is downloaded containing the route track and waypoints

### Requirement: Route versioning
The Journal SHALL store sequential versions of each route. Each GPX update creates a new version.

#### Scenario: View version history
- **WHEN** a route owner views the route detail page
- **THEN** they see a list of versions with version number, date, and contributor

### Requirement: Route list
The Journal SHALL display a list of the authenticated user's routes.

#### Scenario: View my routes
- **WHEN** a logged-in user navigates to their route list
- **THEN** they see all their routes with name, distance, and last updated date

### Requirement: PostGIS spatial storage
Route geometries SHALL be stored as PostGIS LineString geometries extracted from the GPX.

#### Scenario: Spatial data stored on import
- **WHEN** a GPX file is imported or a route is saved from the Planner
- **THEN** the route geometry is extracted and stored as a PostGIS LineString for future spatial queries

### Requirement: Route data includes geometry for rendering
Route and activity loaders SHALL return GeoJSON geometry when available.

#### Scenario: Route list returns simplified geometry
- **WHEN** the routes list loader runs
- **THEN** each route includes a `geojson` field containing the geometry as a GeoJSON string
- **AND** the geometry is simplified server-side via `ST_Simplify()` for list page performance

#### Scenario: Route detail returns full geometry
- **WHEN** the route detail loader runs and the route has geometry
- **THEN** the route includes a `geojson` field with the full-resolution GeoJSON geometry

### Requirement: Route metadata envelope
Routes SHALL be stored with a metadata envelope containing computed statistics (distance, elevation gain/loss), routing profile, contributor list, and tags.

#### Scenario: Metadata computed on save
- **WHEN** a route GPX is saved
- **THEN** distance and elevation statistics are computed from the GPX and stored in the metadata
