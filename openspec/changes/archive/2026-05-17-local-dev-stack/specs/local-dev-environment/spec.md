## MODIFIED Requirements

### Requirement: Optional local monitoring stack
The dev environment SHALL support an optional monitoring profile matching the production stack.

#### Scenario: Start with monitoring
- **WHEN** a developer runs `pnpm dev:full` with `--profile monitoring`
- **THEN** Prometheus, Grafana, and Loki start alongside the app services

### Requirement: Production-aligned PostgreSQL config
The dev PostgreSQL SHALL match production configuration including pg_stat_statements.

#### Scenario: pg_stat_statements available
- **WHEN** the dev PostgreSQL container starts
- **THEN** pg_stat_statements is enabled via initialization scripts

### Requirement: Database seed script
The dev environment SHALL provide a seed script for consistent test data.

#### Scenario: Seed database
- **WHEN** a developer runs the seed script
- **THEN** test users, routes, and activities are created in the local database

### Requirement: Dev environment reset
The dev environment SHALL provide a command to tear down and recreate the local stack.

#### Scenario: Reset dev environment
- **WHEN** a developer runs `pnpm dev:reset`
- **THEN** all Docker volumes are removed, containers are recreated, and the database is re-seeded
