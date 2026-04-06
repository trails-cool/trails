## Purpose

Health endpoints, Prometheus metrics, structured logging, Grafana dashboards, and alerting for both apps and the flagship instance.

## Requirements

### Requirement: Health endpoints
Both apps SHALL expose a `/health` endpoint returning service and database status.

#### Scenario: Healthy service
- **WHEN** the app is running and the database is reachable
- **THEN** `GET /health` returns `{ "status": "ok", "db": "connected", "version": "<string>" }` with HTTP 200 (version from `SENTRY_RELEASE` env var, defaults to `"dev"`)

#### Scenario: Degraded service
- **WHEN** the app is running but the database is unreachable
- **THEN** `GET /health` returns `{ "status": "degraded", "db": "unreachable", "version": "<string>" }` with HTTP 503

### Requirement: Prometheus metrics
Both apps SHALL expose a `/metrics` endpoint with Prometheus-formatted metrics.

#### Scenario: Default Node.js metrics
- **WHEN** Prometheus scrapes `/metrics`
- **THEN** it receives event loop lag, heap usage, and GC metrics

#### Scenario: HTTP request metrics
- **WHEN** requests are served
- **THEN** `http_request_duration_seconds` histogram is updated with route, method, and status labels

#### Scenario: Planner-specific metrics
- **WHEN** the Planner is running
- **THEN** `planner_active_sessions` and `planner_connected_clients` gauges reflect current state

#### Scenario: BRouter latency metrics
- **WHEN** the Planner proxies a routing request to BRouter
- **THEN** `brouter_request_duration_seconds` histogram is updated (buckets: 0.1s to 10s)

### Requirement: Structured logging
Both apps SHALL output structured JSON logs in production.

#### Scenario: Request logging
- **WHEN** an HTTP request is served in production
- **THEN** a JSON log line is emitted with method, path, status, duration, and timestamp

#### Scenario: Dev mode pretty printing
- **WHEN** running in development
- **THEN** logs are human-readable (pretty-printed)

### Requirement: Grafana dashboards
The flagship instance SHALL have pre-configured Grafana dashboards.

#### Scenario: Overview dashboard
- **WHEN** an operator opens Grafana
- **THEN** they see request rate, error rate, and latency percentiles

#### Scenario: Infrastructure dashboard
- **WHEN** an operator checks infrastructure health
- **THEN** they see CPU, memory, disk usage, and DB connection pool stats

### Requirement: Alerting
Grafana SHALL alert on critical conditions.

#### Scenario: Disk usage alert
- **WHEN** disk usage exceeds 80% for 15 minutes
- **THEN** an alert fires

#### Scenario: App down alert
- **WHEN** an app returns zero healthy responses for 2 minutes
- **THEN** an alert fires

### Requirement: Log aggregation
Loki SHALL collect and index logs from all Docker containers.

#### Scenario: Search logs
- **WHEN** an operator searches logs in Grafana
- **THEN** they can filter by container name, log level, and time range
