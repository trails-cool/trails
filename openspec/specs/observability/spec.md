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
Both apps SHALL expose a Prometheus-formatted metrics endpoint. The Planner exposes it at `/metrics` (a server-side route handler outside the React Router app); the Journal exposes it at `/api/metrics` (a route under the React Router app — the `/api` prefix matches the rest of the app's route handlers and avoids colliding with any user-facing `/metrics` page). Prometheus's scrape config in `infrastructure/prometheus/prometheus.yml` reflects this split.

#### Scenario: Default Node.js metrics
- **WHEN** Prometheus scrapes the Journal's `/api/metrics` (or the Planner's `/metrics`)
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

### Requirement: Remote BRouter metrics
Prometheus on the flagship host SHALL scrape BRouter-specific metrics from the dedicated BRouter host over the vSwitch. Scraping SHALL be scoped to BRouter containers only and SHALL NOT collect host-level metrics from the dedicated host's other (non-trails.cool) workloads.

#### Scenario: BRouter container metrics collected
- **WHEN** Prometheus scrapes the dedicated BRouter host
- **THEN** metrics from the BRouter container (and, if enabled, the Caddy sidecar) are collected via cAdvisor filtered by container label, or via a BRouter/JMX metrics endpoint exposed on the vSwitch

#### Scenario: No shared-host noise
- **WHEN** Prometheus is configured with the remote BRouter scrape target
- **THEN** no configuration scrapes the dedicated host's `node_exporter` or metrics from containers other than BRouter and its sidecar

#### Scenario: BRouter scrape failure alert
- **WHEN** the BRouter scrape target returns `up == 0` for more than 2 minutes
- **THEN** Grafana fires an alert distinct from flagship-side alerts

### Requirement: Remote BRouter log shipping
Loki on the flagship host SHALL receive BRouter container logs from the dedicated BRouter host via a Promtail or Alloy agent running on that host as the `trails` user. Log shipping SHALL be scoped to BRouter-related containers only.

#### Scenario: BRouter logs visible in Grafana
- **WHEN** the BRouter container writes to stdout or stderr
- **THEN** the log line is available in Grafana Explore via Loki with container and host labels identifying it as coming from the dedicated BRouter host

#### Scenario: Non-BRouter logs not shipped
- **WHEN** a non-BRouter container on the dedicated host writes logs
- **THEN** those logs are not ingested by the flagship Loki instance

