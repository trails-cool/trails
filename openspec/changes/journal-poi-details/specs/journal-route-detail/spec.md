## MODIFIED Requirements

### Requirement: POI metadata on route detail waypoints
The Journal route detail page SHALL display POI metadata (phone, address, website, opening hours) for waypoints that have associated OpenStreetMap POI data.

#### Scenario: POI metadata displayed on waypoints
- **WHEN** a route detail page is loaded and a waypoint has POI metadata from the Planner
- **THEN** the waypoint displays the POI name, icon, and category alongside its coordinates

#### Scenario: Phone, address, and website shown
- **WHEN** a waypoint has POI metadata including phone, address, or website
- **THEN** those details are shown in the waypoint detail section with appropriate links (tel: for phone, mailto: or https: for website)

#### Scenario: Waypoints without POI data display normally
- **WHEN** a waypoint on the route detail page has no associated POI metadata
- **THEN** the waypoint displays as before with coordinates and name only, with no empty POI sections shown
