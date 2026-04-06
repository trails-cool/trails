## Purpose

Map thumbnails on route and activity list pages, and interactive maps with zoom and layer switching on detail pages.

## Requirements

### Requirement: Route map preview on list pages
Route and activity list pages SHALL show a small map thumbnail for each item that has geometry.

#### Scenario: Route with geometry
- **WHEN** the routes list page loads and a route has a `geom` column
- **THEN** a small map thumbnail is rendered showing the route path
- **AND** the map auto-fits to the route bounds

#### Scenario: Route without geometry
- **WHEN** a route has no `geom` (legacy route)
- **THEN** a placeholder is shown instead of a map thumbnail

#### Scenario: Activity with geometry
- **WHEN** the activities list page loads and an activity has a `geom` column
- **THEN** a small map thumbnail is rendered showing the activity path

### Requirement: Interactive map on detail pages
Route and activity detail pages SHALL show an interactive read-only map with the route/activity drawn.

#### Scenario: Route detail with geometry
- **WHEN** a user views a route detail page and the route has geometry
- **THEN** a full-width interactive map is shown with the route path
- **AND** the map has zoom controls and layer switching
- **AND** the map auto-fits to the route bounds

#### Scenario: Activity detail with geometry
- **WHEN** a user views an activity detail page and the activity has geometry
- **THEN** a full-width interactive map is shown with the activity path

#### Scenario: Detail page without geometry
- **WHEN** a route or activity has no geometry
- **THEN** no map section is rendered
