## ADDED Requirements

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
