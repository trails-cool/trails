## Why

We just had a production outage caused by disk full — and the only way to
diagnose it was SSH + manual docker commands. There are no health endpoints,
no structured logs, no metrics, and no dashboards. When things break, we're
flying blind. The architecture doc specifies a full Grafana + Prometheus + Loki
stack for the flagship instance.

## What Changes

- **Health endpoints**: `/health` on both apps returning service status + DB
  connectivity
- **Structured logging**: JSON logs from both apps (not plain text console.log)
- **Prometheus metrics**: Request latency, active sessions, DB pool stats,
  BRouter response times, exposed via `/metrics` endpoint
- **Grafana + Prometheus + Loki stack**: Self-hosted on the Hetzner server via
  Docker Compose, scraping app metrics and collecting container logs
- **Dashboards**: Pre-configured Grafana dashboards for request latency, error
  rates, active Planner sessions, DB performance, disk usage
- **Alerting**: Grafana alerts for disk usage > 80%, app down, high error rate
- **Caddy access logging**: Enable structured access logs for request visibility

## Capabilities

### New Capabilities

- `observability`: Health endpoints, Prometheus metrics, structured logging,
  Grafana dashboards, and alerting for the flagship instance

### Modified Capabilities

- `infrastructure`: Add Grafana, Prometheus, Loki containers to Docker Compose.
  Configure Caddy access logging.

## Impact

- **Infrastructure**: 3 new Docker containers (Grafana, Prometheus, Loki) +
  config files. Adds ~500MB RAM usage.
- **Server**: CX21 (4GB RAM) might be tight. May need CX22 (8GB) if memory
  is an issue.
- **Files**: New Prometheus/Grafana/Loki configs, modified docker-compose.yml,
  new `/health` and `/metrics` routes, logging utility
- **Dependencies**: `prom-client` for Prometheus metrics, `pino` for structured
  logging
- **Security**: Grafana dashboard behind basic auth or restricted to localhost
  + SSH tunnel. Metrics endpoint not publicly accessible.
- **Ports**: Grafana on 3100 (internal), Prometheus on 9090 (internal)
