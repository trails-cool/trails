## Context

The Hetzner CX21 runs Journal, Planner, BRouter, PostgreSQL, and Caddy. There
is no monitoring — the disk-full outage was only discovered when a user
reported errors. Sentry covers application errors but not infrastructure health,
performance trends, or log aggregation.

## Goals / Non-Goals

**Goals:**
- Health endpoints for uptime monitoring
- Structured JSON logging for searchability
- Prometheus metrics for request latency, DB, sessions, BRouter
- Grafana dashboards for at-a-glance status
- Loki for centralized log aggregation
- Alerts for disk full, app down, high error rate

**Non-Goals:**
- Distributed tracing (Sentry already does this)
- Custom business metrics (user signups, route counts — later)
- External uptime monitoring service (can add later)
- Monitoring for self-hosted instances (flagship only)

## Decisions

### D1: Grafana + Prometheus + Loki in Docker Compose

Add all three as services in the existing docker-compose.yml. They share the
Docker network with the app containers. Prometheus scrapes `/metrics` from
Journal and Planner. Loki collects logs via the Docker logging driver.

Grafana is only accessible via SSH tunnel (`ssh -L 3100:localhost:3100`) or
Caddy with basic auth on a subdomain (e.g., `grafana.trails.cool`).

### D2: Pino for structured logging

Replace `console.log`/`console.error` with Pino. JSON output in production,
pretty-print in dev. Pino is the standard Node.js structured logger — fast,
zero-dep in production, and Loki-compatible.

Create a shared logging utility in `packages/logging/` or keep it simple
with per-app `lib/logger.server.ts`.

### D3: prom-client for Prometheus metrics

Use `prom-client` to expose a `/metrics` endpoint on each app. Default Node.js
metrics (event loop lag, heap, GC) plus custom:
- `http_request_duration_seconds` (histogram, by route + method + status)
- `planner_active_sessions` (gauge)
- `planner_connected_clients` (gauge)
- `brouter_request_duration_seconds` (histogram)
- `db_pool_active_connections` (gauge)

### D4: Health endpoint checking DB connectivity

`GET /health` returns `{ status: "ok", db: "connected" }` or
`{ status: "degraded", db: "unreachable" }` with appropriate HTTP status.
Used by Docker healthcheck and external monitoring.

### D5: Caddy access logs to stdout (Loki picks them up)

Enable Caddy's `log` directive. Structured JSON access logs go to stdout,
Docker sends them to Loki via the logging driver. No sidecar needed.

### D6: Grafana provisioned dashboards

Ship dashboard JSON files in `infrastructure/grafana/dashboards/`. Grafana
auto-loads them via provisioning config. Dashboards:
- **Overview**: Request rate, error rate, latency p50/p95/p99
- **Planner**: Active sessions, connected clients, BRouter latency
- **Infrastructure**: CPU, memory, disk, DB connections

### D7: Alert rules via Grafana

Configure alert rules in provisioned dashboard or as code:
- Disk usage > 80% (fires 15 min)
- Any app returns 0 healthy responses for 2 min
- Error rate > 5% for 5 min
- DB connection pool exhausted

Notifications via email (Resend, once transactional-emails is implemented)
or webhook.

## Risks / Trade-offs

- **Memory pressure** → Grafana + Prometheus + Loki add ~500MB. CX21 has 4GB,
  currently using ~2GB. Tight but workable. Monitor and upgrade to CX22 if
  needed.
- **Disk usage** → Prometheus retention default 15 days, Loki retention
  configurable. Set conservative limits (1GB each).
- **Complexity** → Three new services to maintain. Mitigated by using official
  Docker images with minimal config.
