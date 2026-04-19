## ADDED Requirements

### Requirement: Separate Overpass host
The trails.cool infrastructure SHALL include a second Hetzner host, distinct from the existing compose host, dedicated to running the Overpass service and its OSM data volume.

#### Scenario: Host isolation
- **WHEN** the operator provisions the Overpass host
- **THEN** it runs only the Overpass stack (plus its firewall/tooling) and shares no filesystem, database, or container with the existing trails.cool compose host

#### Scenario: Host-specific configuration lives in its own directory
- **WHEN** a change is made to the Overpass host configuration
- **THEN** the change is contained to a dedicated `infrastructure/overpass-host/` directory (compose file, Dockerfile wrapper, firewall rule template, load scripts) and does not touch the existing compose stack

### Requirement: Planner-side configuration for the Overpass proxy
The Planner container SHALL read the Overpass endpoint from an environment variable so the target host can be swapped without code changes.

#### Scenario: Endpoint configurable
- **WHEN** the operator sets `OVERPASS_URL` on the Planner container to any reachable Overpass endpoint
- **THEN** the Planner proxy route forwards queries to that endpoint without a rebuild or code change

#### Scenario: Missing configuration handled gracefully
- **WHEN** `OVERPASS_URL` is unset or empty
- **THEN** the Planner proxy responds with a service-unavailable status and a log message, rather than contacting an unintended default

### Requirement: Overpass observability
The infrastructure SHALL surface basic Overpass health signals via the existing Prometheus / Grafana stack.

#### Scenario: Service up metric
- **WHEN** Prometheus scrapes the overpass service (directly or via a sidecar exporter / blackbox probe)
- **THEN** an `overpass_up` gauge reflects whether the service is responding to health checks

#### Scenario: Replication lag metric
- **WHEN** Prometheus scrapes the overpass replication state
- **THEN** a metric reports the age of the most recently applied OSM diff, so alerts can fire when lag exceeds 48 hours
