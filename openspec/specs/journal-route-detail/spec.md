## Purpose

The Journal route detail page displays a saved route with its metadata, map, elevation, day breakdown, and waypoint POI details.

## Requirements

### Requirement: POI metadata on route detail waypoints
The Journal route detail page SHALL display POI metadata (phone, address, website, opening hours) for waypoints that have associated OpenStreetMap POI data.

#### Scenario: POI metadata displayed on waypoints
- **WHEN** a route detail page is loaded and a waypoint has POI metadata from the Planner
- **THEN** the waypoint displays the POI name, icon, and category alongside its coordinates

#### Scenario: Phone, address, website, and opening hours shown
- **WHEN** a waypoint has POI metadata including phone, address, website, or opening hours
- **THEN** those details are shown in the waypoint detail section with appropriate links (tel: for phone, https: for website; opening hours displayed as text)

Note: `mailto:` links for websites are not rendered — all website values are treated as `https:` links. The `opening_hours` OSM tag is also displayed when present.

#### Scenario: Waypoints without POI data display normally
- **WHEN** a waypoint on the route detail page has no associated POI metadata
- **THEN** the waypoint displays as before with coordinates and name only, with no empty POI sections shown
