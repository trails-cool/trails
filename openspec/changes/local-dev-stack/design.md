## Context

trails.cool runs `docker-compose.dev.yml` for local dev (PostgreSQL + BRouter)
and `infrastructure/docker-compose.yml` for production (full stack with Caddy,
Prometheus, Grafana, Loki, exporters). There is no staging environment. CI runs
E2E tests with a manually started PostgreSQL container and a separately
downloaded BRouter, not reusing the dev compose file. The gap between local dev
and production causes issues:

1. Monitoring changes (alert rules, dashboards) are untestable before deploy
2. CI's PostgreSQL setup diverges from both dev and prod (no PostGIS extensions
   preloaded, no pg_stat_statements, no init scripts)
3. The dev PostgreSQL lacks `pg_stat_statements` which means queries that depend
   on it (like Grafana datasource queries) fail locally

## Goals / Non-Goals

**Goals:**
- Local dev PostgreSQL matches production config (pg_stat_statements, init
  scripts)
- Optional monitoring stack available locally via a compose profile
- CI E2E tests use the same compose file as local dev
- One-command reset for a clean dev environment
- Seed data available for both local dev and CI

**Non-Goals:**
- Replicating the production Caddy reverse proxy locally (apps run natively
  with Vite, no TLS needed for local dev)
- Running S3/Garage locally (media storage is a future concern)
- Federation testing (ActivityPub requires publicly reachable endpoints)
- Matching exact production image versions (dev uses source builds, prod uses
  GHCR images)

## Decisions

### D1: Extend docker-compose.dev.yml with profiles, don't create a new file

Add monitoring services to the existing `docker-compose.dev.yml` using Docker
Compose profiles. The core services (postgres, brouter) have no profile
assigned and always start. Monitoring services get the `monitoring` profile
and only start when explicitly requested.

```bash
pnpm dev:services                              # postgres + brouter (default)
docker compose -f docker-compose.dev.yml --profile monitoring up -d  # + monitoring
```

**Alternative**: Separate `docker-compose.monitoring.yml` with `extends`.
Rejected — profiles are the standard Docker Compose mechanism for this, and a
single file is simpler to maintain.

### D2: Service profiles — core always runs, monitoring is opt-in

Two logical groups:

| Profile | Services | When |
|---------|----------|------|
| *(none)* | postgres, brouter | Always — required for app development |
| `monitoring` | prometheus, grafana, loki | Opt-in — for testing observability changes |

Production-only services NOT included locally: Caddy (apps run natively),
node-exporter (host metrics not useful in Docker Desktop), cadvisor (container
metrics not useful locally), postgres-exporter (can add later if needed).

Grafana runs with anonymous auth locally (no GitHub OAuth), connecting to
the local Prometheus and Loki instances.

### D3: Database initialization — auto-push schema, seed script for test data

On `pnpm dev:full`, the `scripts/dev.sh` script already runs `pnpm db:push`.
Add a seed script (`scripts/seed.ts`) that inserts test data:

- A test user account in Journal
- A sample route with waypoints (Berlin area, matching the BRouter segment)
- A sample activity linked to the route

The seed script is idempotent (uses `ON CONFLICT DO NOTHING`). It runs
automatically in `dev:full` but can be run standalone with `pnpm db:seed`.

For CI, the seed script runs after `db:push` and before E2E tests, ensuring
tests have consistent data to work with.

### D4: CI uses compose file for services

Replace the manual `docker run` and BRouter download steps in `.github/
workflows/ci.yml` with:

```yaml
- name: Start services
  run: docker compose -f docker-compose.dev.yml up -d --wait
```

The `--wait` flag blocks until health checks pass, replacing the manual
`pg_isready` loops. BRouter still builds from the local Dockerfile in
`docker/brouter/` and uses the same segment download mechanism.

Benefits:
- CI and local dev use identical service configuration
- Health check logic is defined once (in compose) not twice (compose + CI)
- Simpler CI workflow with fewer steps

Trade-off: Docker Compose in CI adds ~5s overhead for compose parsing. The
PostGIS image is already cached. BRouter segment download is already cached.
Net time should be similar or faster due to parallel health checks.

### D5: dev.sh improvements — health checks, error messages, monitoring flag

Improve `scripts/dev.sh`:

1. **Health check with timeout**: Use `docker compose up -d --wait` instead
   of manual `pg_isready` loop. This respects the healthcheck config in the
   compose file and has a built-in timeout.
2. **Error messages**: If Docker is not running, print a clear message instead
   of a cryptic error. Check for Docker before anything else.
3. **Monitoring flag**: `pnpm dev:full -- --monitoring` starts the monitoring
   profile alongside core services.
4. **Seed data**: Run seed script after schema push.

### D6: Environment — .env.development template with sensible defaults

Create `.env.development` (gitignored) from `.env.development.example`
(committed). All values have working defaults so local dev works with zero
configuration:

```env
DATABASE_URL=postgres://trails:trails@localhost:5432/trails
BROUTER_URL=http://localhost:17777
JWT_SECRET=dev-secret-not-for-production
SESSION_SECRET=dev-secret-not-for-production
```

The apps already read `DATABASE_URL` from environment. The `.env.development`
file is for documentation and convenience — `scripts/dev.sh` sets these
values if not already present.

## Risks / Trade-offs

**[Monitoring profile adds image pulls]** → First `--profile monitoring` run
downloads Prometheus, Grafana, Loki images (~500MB). Mitigation: one-time
cost, cached by Docker.

**[Compose in CI needs Docker Compose v2]** → GitHub Actions ubuntu-latest
includes Docker Compose v2. No action needed.

**[Seed data can drift from schema]** → If schema changes, seed script may
break. Mitigation: seed script uses Drizzle ORM (not raw SQL), so TypeScript
catches drift at compile time.

**[BRouter segment download in CI]** → The compose file builds BRouter from
Dockerfile but doesn't include segments. CI still needs the segment download
step (cached). The compose file mounts a local directory for segments.
