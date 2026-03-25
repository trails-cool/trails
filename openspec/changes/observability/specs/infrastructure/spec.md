## MODIFIED Requirements

### Requirement: Docker Compose deployment
All services SHALL be deployed via Docker Compose, including Grafana, Prometheus, and Loki for the flagship instance.

#### Scenario: Monitoring stack starts
- **WHEN** `docker compose up -d` is run
- **THEN** Grafana, Prometheus, and Loki containers start alongside the application containers

### Requirement: Caddy access logging
Caddy SHALL emit structured JSON access logs for all requests.

#### Scenario: Access log emitted
- **WHEN** any HTTP request passes through Caddy
- **THEN** a JSON log line with remote IP, method, path, status, and duration is written to stdout
