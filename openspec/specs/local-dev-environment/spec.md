## Purpose

One-command local development setup with PostgreSQL, BRouter, automatic schema migration, and segment downloading.

## When to Use Local vs. Staging

| Scenario | Use |
|----------|-----|
| Everyday development, unit tests, E2E tests | Local (`pnpm dev:full`) |
| Sharing a work-in-progress with reviewers | PR preview (`pr-<N>.staging.trails.cool`) |
| Testing against production-like infra (Caddy TLS, Docker networking) | Staging (`staging.trails.cool`) |
| Wahoo OAuth callback testing | Local with `HTTPS=1` (see CLAUDE.md) |
| ActivityPub federation testing | Staging (requires real HTTPS + public domain) |

The Planner, Journal, PostgreSQL, and BRouter all run locally. The local stack is the default for all development work. Staging is not a replacement for local dev — it is a pre-merge verification surface and a way to share work without merging first.

## Requirements

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

### Requirement: Optional local monitoring stack
The dev environment SHALL support an optional monitoring profile matching the production stack.

#### Scenario: Start with monitoring
- **WHEN** a developer runs `pnpm dev:full` with `--monitoring`
- **THEN** Prometheus, Grafana, and Loki start alongside the app services

### Requirement: Production-aligned PostgreSQL config
The dev PostgreSQL SHALL match production configuration including pg_stat_statements.

#### Scenario: pg_stat_statements available
- **WHEN** the dev PostgreSQL container starts
- **THEN** pg_stat_statements is enabled via initialization scripts

### Requirement: Database seed script
The dev environment SHALL provide a seed script for consistent test data.

#### Scenario: Seed database
- **WHEN** a developer runs `pnpm db:seed`
- **THEN** test users, routes, and activities are created idempotently in the local database

### Requirement: Dev environment reset
The dev environment SHALL provide a command to tear down and recreate the local stack.

#### Scenario: Reset dev environment
- **WHEN** a developer runs `pnpm dev:reset`
- **THEN** all Docker volumes are removed and containers are recreated
