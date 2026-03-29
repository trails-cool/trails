## ADDED Requirements

### Requirement: Map-based route discovery
Users SHALL be able to discover public routes by browsing a map.

#### Scenario: Browse routes on map
- **WHEN** a user visits the route explore page and pans/zooms the map
- **THEN** public routes within the visible area are shown as polylines on the map

#### Scenario: Route preview
- **WHEN** a user clicks a route on the explore map
- **THEN** a popup or sidebar shows the route name, distance, elevation, and a link to the detail page
