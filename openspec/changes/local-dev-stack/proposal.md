## Why

There is no staging environment — production is the only deployed instance. Infra
changes (Prometheus alerts, Caddy config, Grafana dashboards) go straight to prod
with no way to validate them locally first. Meanwhile, CI E2E tests skip ~15 of
20 tests because there is no PostgreSQL service in the workflow, and BRouter was
only recently added to CI with manual setup instead of reusing the dev compose
file. The existing `docker-compose.dev.yml` covers PostgreSQL and BRouter but
nothing else from the production stack.

## What Changes

- Extend `docker-compose.dev.yml` with an optional monitoring profile
  (Prometheus, Grafana, Loki) so developers can test observability changes
  locally before deploying to production
- Add `pg_stat_statements` and initialization scripts to the dev PostgreSQL
  to match production config
- Improve `scripts/dev.sh` with proper health checks and better error output
- Simplify CI by using the same compose file instead of ad-hoc `docker run`
  commands
- Add a database seed script for consistent test data
- Add a `pnpm dev:reset` command to tear down and recreate the local stack

## Capabilities

### New Capabilities

- `local-monitoring`: Optional local Prometheus + Grafana + Loki stack via
  `--profile monitoring`, matching production monitoring configuration
- `dev-reset`: One command to wipe and recreate the local dev environment

### Modified Capabilities

- `local-dev-environment`: PostgreSQL config aligned with production
  (pg_stat_statements, init scripts), improved health checks, seed data

## Impact

- **docker-compose.dev.yml**: Add monitoring services behind a profile, update
  postgres config to match production
- **.github/workflows/ci.yml**: Replace manual `docker run` with compose-based
  service startup
- **scripts/dev.sh**: Better health checks, error messages, optional monitoring
- **scripts/reset-dev.sh**: New script to wipe volumes and restart
- **scripts/seed.ts**: Test data for local development and E2E tests
- **Dependencies**: None new (all Docker images already used in production)
