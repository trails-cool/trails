## Purpose

Route CRUD operations, GPX import/export, sequential versioning, PostGIS spatial storage, and route metadata in the Journal app.
## Requirements
### Requirement: Create route
The Journal SHALL allow authenticated users to create a new route with a name and optional description.

#### Scenario: Create empty route
- **WHEN** a user clicks "New Route" and enters a name
- **THEN** a new route record is created in PostgreSQL and the user is redirected to the route detail page

### Requirement: View route
The Journal SHALL display route details including map, metadata, and elevation stats. Access depends on the route's `visibility`: `public` routes are viewable by anyone including unauthenticated visitors, `unlisted` routes are viewable by anyone who has the URL, and `private` routes are viewable only by the owner.

#### Scenario: Owner views own route
- **WHEN** a logged-in user navigates to a route they own at any visibility
- **THEN** they see the route name, description, a map with the route polyline, distance, and elevation gain/loss

#### Scenario: Anyone views a public route
- **WHEN** any visitor (including unauthenticated) navigates to a `public` route's URL
- **THEN** they see the full route detail page as above

#### Scenario: Anyone with the URL views an unlisted route
- **WHEN** any visitor navigates directly to an `unlisted` route's URL
- **THEN** they see the full route detail page as above

#### Scenario: Non-owner is blocked from a private route
- **WHEN** a visitor who is not the owner requests a `private` route URL
- **THEN** the server responds with HTTP 404 (not 403), so the existence of the private route is not leaked

#### Scenario: Public and unlisted route pages emit social-share metadata
- **WHEN** a visitor loads a `public` or `unlisted` route detail page
- **THEN** the response emits Open Graph and Twitter Card meta tags (`og:title`, `og:description`, `og:type="article"`, `og:site_name`, `twitter:card="summary"`)

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

### Requirement: Route visibility
The Journal SHALL persist a `visibility` value on every route and SHALL allow the owner to change it.

#### Scenario: New routes default to private
- **WHEN** a route is created without an explicit visibility
- **THEN** the route row is persisted with `visibility = 'private'`

#### Scenario: Owner changes a route's visibility
- **WHEN** a route owner selects a different visibility (`private`, `unlisted`, `public`) in the edit flow and saves
- **THEN** the stored visibility is updated and subsequent access checks use the new value immediately

#### Scenario: Non-owner cannot change visibility
- **WHEN** a request to update visibility arrives from a user who is not the route owner
- **THEN** the server rejects it with HTTP 403 or 404 (matching the current update-route behaviour), and the stored value is unchanged

### Requirement: Route listings respect visibility
Any listing that exposes routes beyond the owner's own dashboard SHALL only include routes with `visibility = 'public'`.

#### Scenario: Public profile lists only public routes
- **WHEN** a visitor loads `/users/:username`
- **THEN** the rendered list of routes includes only the user's `public` routes; `unlisted` and `private` routes are omitted

#### Scenario: Owner's own routes list is unchanged
- **WHEN** a logged-in user views their own routes list at `/routes`
- **THEN** the list includes all of their own routes regardless of visibility

