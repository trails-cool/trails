## ADDED Requirements

### Requirement: Self-hosted Overpass service
The trails.cool infrastructure SHALL run an Overpass API instance as a Docker service on a dedicated host, populated from a configurable regional OpenStreetMap extract, and reachable only from the Planner host.

#### Scenario: Service reachable from the Planner host
- **WHEN** the Planner server sends an Overpass query from its configured egress address to the Overpass host on the configured port
- **THEN** the request is accepted and served

#### Scenario: Service not reachable from any other source
- **WHEN** any other host on the public internet attempts to connect to the Overpass host's Overpass port
- **THEN** the connection is dropped by the host firewall and the Overpass service never sees the packets

#### Scenario: Regional extract is configurable
- **WHEN** the operator sets a different `OVERPASS_PBF_URL` and runs the initial-load procedure
- **THEN** the service comes up populated from that extract without code changes

### Requirement: Firewall compatible with Docker
The Overpass host firewall SHALL enforce the allowlist in a way that survives Docker daemon restarts, container restarts, and port-publication rule changes — i.e. user rules MUST be placed on the chain Docker reserves for user-managed filtering rather than relying on chains that Docker bypasses when publishing container ports.

#### Scenario: Rule survives container restart
- **WHEN** the Overpass container is stopped and started
- **THEN** the firewall allowlist is still in effect and unauthorised sources are still dropped without operator intervention

#### Scenario: Rule survives Docker daemon restart
- **WHEN** the Docker daemon on the Overpass host is restarted
- **THEN** the firewall allowlist is still in effect and unauthorised sources are still dropped without operator intervention

#### Scenario: Planner host address change
- **WHEN** the Planner host's egress address changes and the operator updates the configured allowlist address
- **THEN** applying the updated ruleset restores Planner connectivity without requiring Docker or Overpass to restart

### Requirement: Overpass data refresh
The Overpass service SHALL keep its OSM database current by applying upstream diffs on a recurring schedule without manual intervention after the initial import.

#### Scenario: Daily replication
- **WHEN** 24 hours have passed since the last diff application
- **THEN** the container has fetched and applied the next diff from the upstream provider, and the replication timestamp advances

#### Scenario: Recoverable replication failure
- **WHEN** diff replication fails once (network blip, upstream 5xx)
- **THEN** the container retries on its next scheduled interval without requiring an operator to restart it

#### Scenario: Replication lag observable
- **WHEN** replication has been failing for more than 48 hours
- **THEN** a monitoring signal indicates the service is stale so the operator can investigate

### Requirement: Planner Overpass proxy route
The Planner server SHALL expose an authenticated, rate-limited proxy route that forwards Overpass QL queries to the Overpass host. This SHALL be the only path through which Overpass is reachable from outside the Overpass host.

#### Scenario: Forward valid query
- **WHEN** an authenticated Planner browser session POSTs a valid Overpass QL query to `/api/overpass`
- **THEN** the proxy forwards the query to the Overpass service and returns the upstream response body and status

#### Scenario: Reject unauthenticated request
- **WHEN** a request arrives at `/api/overpass` without a valid Planner session cookie
- **THEN** the proxy responds with HTTP 401 and does not contact the Overpass service

#### Scenario: Reject cross-origin request
- **WHEN** a request arrives at `/api/overpass` with an Origin header not matching the Planner's own origin
- **THEN** the proxy responds with HTTP 403 and does not contact the Overpass service

#### Scenario: Rate limit exceeded
- **WHEN** a session sends more Overpass queries than the configured per-session limit allows within the rate-limit window
- **THEN** the proxy responds with HTTP 429 and does not contact the Overpass service

### Requirement: Initial data load is out-of-band
The initial import of the regional OSM extract into the Overpass database SHALL NOT run as part of a normal deploy and SHALL NOT block routine container restarts once the data volume is populated.

#### Scenario: First-time setup
- **WHEN** the operator provisions a new Overpass host with an empty data volume
- **THEN** a documented one-shot procedure (e.g. a compose-run command) performs the initial PBF download and import, and exits cleanly

#### Scenario: Routine restart
- **WHEN** the `overpass` service is restarted with an already-populated data volume
- **THEN** the service comes up and is query-ready without re-importing data
