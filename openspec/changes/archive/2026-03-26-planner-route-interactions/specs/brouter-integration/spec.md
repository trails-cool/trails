## MODIFIED Requirements

### Requirement: Route computation from waypoints
The Planner SHALL compute a route between ordered waypoints by calling the BRouter HTTP API with tiledesc enabled and returning the result as an EnrichedRoute, preserving per-point elevation, surface data, and segment boundary indices.

#### Scenario: Compute route with two waypoints
- **WHEN** the routing host submits two waypoints (start, end) with profile "trekking"
- **THEN** the BRouter API returns a route within 2 seconds

#### Scenario: Compute route with via points
- **WHEN** the routing host submits three or more waypoints
- **THEN** the BRouter API returns a route passing through all waypoints in order

#### Scenario: Per-point elevation preserved
- **WHEN** BRouter returns GeoJSON with 3D coordinates [lon, lat, ele]
- **THEN** the merged route response SHALL preserve elevation values for every coordinate point

#### Scenario: Segment boundaries tracked
- **WHEN** a route with N waypoints is computed (N-1 segments)
- **THEN** the response SHALL include an array of coordinate indices marking where each waypoint-to-waypoint segment begins

#### Scenario: Surface data extracted
- **WHEN** BRouter returns tiledesc messages with WayTags containing surface information
- **THEN** the response SHALL include a surface type string per coordinate point extracted from the WayTags (e.g., "asphalt", "gravel", "path")
