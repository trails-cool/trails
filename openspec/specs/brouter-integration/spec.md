## Purpose

Route computation between waypoints via the BRouter HTTP API, including routing host election, result broadcasting via Yjs, profile selection, and rate-limited proxying.
## Requirements
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
The Planner backend SHALL proxy all BRouter API calls. Clients SHALL NOT communicate with BRouter directly. The proxy SHALL attach a `X-BRouter-Auth: <token>` header to every upstream request using the `BROUTER_AUTH_TOKEN` environment variable.

#### Scenario: Proxied route request
- **WHEN** the routing host client requests a route computation
- **THEN** the Planner backend forwards the request to BRouter over the configured upstream URL with the `X-BRouter-Auth` header set, applies rate limiting, and returns the response

#### Scenario: Missing auth token at startup
- **WHEN** the Planner starts in production without `BROUTER_AUTH_TOKEN` set
- **THEN** the Planner logs a fatal error and refuses to start

### Requirement: Rate limiting
The Planner backend SHALL rate limit BRouter API calls to prevent abuse.

#### Scenario: Rate limit exceeded
- **WHEN** a session exceeds 60 route computations per hour
- **THEN** subsequent requests receive a 429 response with a Retry-After header

### Requirement: BRouter Docker deployment
BRouter SHALL run as a Docker container on a dedicated Hetzner host reached over a private Hetzner vSwitch, with planet-wide RD5 segments mounted as a volume. The BRouter container SHALL NOT be exposed on any public network interface.

#### Scenario: BRouter container starts
- **WHEN** the `docker compose up -d` command runs in `~trails/brouter/` on the dedicated host
- **THEN** the BRouter container is reachable only on the vSwitch-bound IP and can compute routes using the mounted planet-wide RD5 segments

#### Scenario: Public network isolation
- **WHEN** a request is sent to the dedicated host's public IP on the BRouter port
- **THEN** the request is refused at the host firewall or times out; BRouter does not respond

#### Scenario: JVM memory sizing
- **WHEN** the BRouter container starts
- **THEN** the JVM is launched with `-Xmx8g` (or equivalent) so that the heap does not exceed 8 GB on the 32 GB host

### Requirement: BRouter routing with constraints
Route computation SHALL include no-go area polygons as avoidance constraints.

#### Scenario: Route with no-go areas
- **WHEN** the routing host computes a route and no-go areas exist
- **THEN** the BRouter request includes nogo parameters for each polygon

### Requirement: Shared-secret auth on BRouter
The BRouter deployment SHALL require a shared-secret header on every request. Requests without a valid `X-BRouter-Auth` header SHALL be rejected before reaching the BRouter process.

#### Scenario: Valid token
- **WHEN** a request arrives at the BRouter host with the correct `X-BRouter-Auth` header
- **THEN** the Caddy sidecar forwards the request to BRouter and returns its response

#### Scenario: Missing or wrong token
- **WHEN** a request arrives without an `X-BRouter-Auth` header or with an incorrect value
- **THEN** the Caddy sidecar responds with HTTP 403 and does not forward the request to BRouter

#### Scenario: Token not logged
- **WHEN** Caddy emits an access log line for a BRouter request
- **THEN** the `X-BRouter-Auth` header value is redacted or omitted from the log line

