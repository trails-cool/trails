## ADDED Requirements

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

### Requirement: Routing host election
The Planner SHALL elect one participant per session as the "routing host" who is responsible for sending waypoint changes to BRouter. Only the host SHALL make BRouter API calls.

#### Scenario: Initial host assignment
- **WHEN** a session is created
- **THEN** the session creator is assigned as the routing host via Yjs awareness state

#### Scenario: Host failover
- **WHEN** the current routing host disconnects
- **THEN** failover is immediate via deterministic Yjs clientID election: the client with the lowest remaining ID becomes host instantly

### Requirement: Route broadcast
The routing host SHALL store computed route results in the Yjs document so that all participants receive route updates automatically.

#### Scenario: Route update propagation
- **WHEN** the routing host receives a new route from BRouter
- **THEN** the route GeoJSON is stored in a Y.Map field and all participants see the updated route on their maps

### Requirement: Profile selection
The Planner SHALL support selecting a routing profile that determines how BRouter computes the route.

#### Scenario: Switch routing profile
- **WHEN** a user changes the routing profile (available profiles: `trekking`, `fastbike`, `safety`, `shortest`, `car`)
- **THEN** the profile change syncs via Yjs and the routing host recomputes the route

### Requirement: BRouter API proxy
The Planner backend SHALL proxy all BRouter API calls. Clients SHALL NOT communicate with BRouter directly.

#### Scenario: Proxied route request
- **WHEN** the routing host client requests a route computation
- **THEN** the Planner backend forwards the request to BRouter, applies rate limiting, and returns the response

### Requirement: Rate limiting
The Planner backend SHALL rate limit BRouter API calls to prevent abuse.

#### Scenario: Rate limit exceeded
- **WHEN** a session exceeds 60 route computations per hour
- **THEN** subsequent requests receive a 429 response with a Retry-After header

### Requirement: BRouter Docker deployment
BRouter SHALL run as a separate Docker container with Germany RD5 segments mounted as a volume.

#### Scenario: BRouter container starts
- **WHEN** the Docker Compose stack starts
- **THEN** the BRouter container is reachable at its internal HTTP port and can compute routes using the mounted RD5 segments

### Requirement: BRouter routing with constraints
Route computation SHALL include no-go area polygons as avoidance constraints.

#### Scenario: Route with no-go areas
- **WHEN** the routing host computes a route and no-go areas exist
- **THEN** the BRouter request includes nogo parameters for each polygon
