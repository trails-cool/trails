## MODIFIED Requirements

### Requirement: Grafana database access
The `grafana_reader` PostgreSQL role SHALL have SELECT access to the `pgboss` schema for job queue observability.

#### Scenario: Grant access on deploy
- **WHEN** the infrastructure deploy runs
- **THEN** `grafana_reader` is granted `USAGE` on the `pgboss` schema and `SELECT` on all tables in it

### Requirement: Monitoring stack
The Grafana Service Health dashboard SHALL include a job queue health panel.

#### Scenario: Job queue panel displays metrics
- **WHEN** a user views the Service Health dashboard
- **THEN** they see a panel showing job queue depth, completed jobs per hour, and failed jobs
- **AND** failed jobs are highlighted for investigation
