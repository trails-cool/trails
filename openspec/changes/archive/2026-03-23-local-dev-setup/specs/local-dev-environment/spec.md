## ADDED Requirements

### Requirement: One-command dev startup
The project SHALL provide a single command that starts all services needed for local development.

#### Scenario: Start full dev stack
- **WHEN** a developer runs `pnpm dev:full`
- **THEN** PostgreSQL, BRouter, and both apps start and are reachable at their respective ports

#### Scenario: Services are healthy before apps start
- **WHEN** the dev script starts
- **THEN** it waits for PostgreSQL health check and BRouter readiness before starting the apps

### Requirement: Automatic database setup
The dev environment SHALL automatically create schemas and tables on startup.

#### Scenario: First run database setup
- **WHEN** `pnpm dev:full` runs for the first time
- **THEN** the planner and journal PostgreSQL schemas and tables are created automatically

### Requirement: BRouter segment for local testing
The dev environment SHALL include at least one BRouter segment for route computation testing.

#### Scenario: Download segment on first run
- **WHEN** the BRouter Docker volume has no segments
- **THEN** the dev script downloads E10_N50.rd5 (Berlin area, ~124MB)

#### Scenario: Skip download if segment exists
- **WHEN** the BRouter Docker volume already has segments
- **THEN** the dev script skips the download

### Requirement: Local route computation
The Planner SHALL be able to compute routes locally in the dev environment.

#### Scenario: Compute a route in Berlin
- **WHEN** a developer sends a route request with two Berlin waypoints to the local Planner
- **THEN** the Planner proxies to local BRouter and returns a valid GeoJSON route
