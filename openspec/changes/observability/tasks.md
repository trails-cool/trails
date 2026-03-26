## 1. Health Endpoints

- [x] 1.1 Add `/health` API route to Journal — checks DB with a simple query, returns status JSON
- [x] 1.2 Add `/health` endpoint to Planner server.ts — checks DB connectivity
- [x] 1.3 Update Docker healthcheck in docker-compose.yml to use `/health` instead of `pg_isready`
- [x] 1.4 Add health routes to route configs (journal routes.ts)

## 2. Structured Logging

- [x] 2.1 Add `pino` dependency to both apps
- [x] 2.2 Create `apps/journal/app/lib/logger.server.ts` — Pino instance, JSON in prod, pretty in dev
- [x] 2.3 Create `apps/planner/app/lib/logger.server.ts` — same pattern
- [x] 2.4 Replace key `console.log`/`console.error` calls with logger (auth, DB errors, session lifecycle)
- [x] 2.5 Add request logging middleware to Planner server.ts (method, path, status, duration)

## 3. Prometheus Metrics

- [x] 3.1 Add `prom-client` dependency to both apps
- [x] 3.2 Create metrics utility for Journal — default metrics + http_request_duration_seconds histogram
- [x] 3.3 Create metrics utility for Planner — default metrics + http histogram + planner_active_sessions + planner_connected_clients gauges + brouter_request_duration_seconds histogram
- [x] 3.4 Add `/metrics` endpoint to Journal (API route)
- [x] 3.5 Add `/metrics` endpoint to Planner server.ts
- [x] 3.6 Wire request duration tracking into request handlers

## 4. Caddy Access Logs

- [x] 4.1 Enable Caddy structured JSON access logging in Caddyfile (log directive)

## 5. Monitoring Stack (Docker Compose)

- [x] 5.1 Add Prometheus container to docker-compose.yml with scrape config for journal:3000 and planner:3001
- [x] 5.2 Add Loki container to docker-compose.yml with Docker logging driver config
- [x] 5.3 Add Grafana container to docker-compose.yml with provisioned data sources (Prometheus + Loki)
- [x] 5.4 Create `infrastructure/prometheus/prometheus.yml` — scrape config
- [x] 5.5 Create `infrastructure/loki/loki-config.yml` — retention, storage
- [x] 5.6 Create `infrastructure/grafana/provisioning/` — data sources + dashboard provider config
- [x] 5.7 Expose Grafana via Caddy on grafana.trails.cool with basic auth

## 6. Dashboards

- [x] 6.1 Create overview dashboard JSON — request rate, error rate, latency p50/p95/p99
- [x] 6.2 Create planner dashboard JSON — active sessions, connected clients, BRouter latency
- [x] 6.3 Create infrastructure dashboard JSON — node_exporter or cAdvisor metrics (CPU, memory, disk)

## 7. Alerting

- [x] 7.1 Configure Grafana alert rule: disk usage > 80%
- [x] 7.2 Configure Grafana alert rule: app health check failing for 2 min
- [x] 7.3 Configure Grafana alert rule: error rate > 5% for 5 min
- [x] 7.4 Set up alert notification channel (email or webhook)

## 8. DNS & Terraform

- [x] 8.1 Add grafana.trails.cool DNS record
- [x] 8.2 Add Grafana basic auth credentials to deploy secrets

## 9. Verify

- [x] 9.1 Test /health endpoints locally — verify OK and degraded responses
- [x] 9.2 Test /metrics endpoints — verify Prometheus format output
- [x] 9.3 Test Grafana dashboards load with data after deploy
- [x] 9.4 Test alert fires when simulating disk full condition
