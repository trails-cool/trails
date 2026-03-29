## 1. Docker Compose

- [ ] 1.1 Update dev PostgreSQL to match production: add `shared_preload_libraries=pg_stat_statements` command and mount `infrastructure/postgres/init-grafana-user.sql` as init script
- [ ] 1.2 Add Prometheus service with `monitoring` profile, mounting `infrastructure/prometheus/prometheus.yml`
- [ ] 1.3 Add Grafana service with `monitoring` profile, anonymous auth enabled, provisioned with local Prometheus and Loki datasources
- [ ] 1.4 Add Loki service with `monitoring` profile, mounting `infrastructure/loki/loki-config.yml`

## 2. Database

- [ ] 2.1 Create `scripts/seed.ts` with idempotent test data: user account, sample route (Berlin area), sample activity. Use Drizzle ORM, `ON CONFLICT DO NOTHING`
- [ ] 2.2 Add `pnpm db:seed` script to root package.json that runs `scripts/seed.ts` with `--experimental-strip-types`

## 3. CI Integration

- [ ] 3.1 Replace manual `docker run` PostgreSQL setup in `ci.yml` e2e job with `docker compose -f docker-compose.dev.yml up -d --wait`
- [ ] 3.2 Replace manual BRouter download/start in `ci.yml` with the compose BRouter service plus cached segment mount
- [ ] 3.3 Add `pnpm db:seed` step after `pnpm db:push` in CI e2e job
- [ ] 3.4 Remove any E2E test skip workarounds that check for DB availability (the `withDb()` 503 skip pattern)

## 4. Scripts

- [ ] 4.1 Improve `scripts/dev.sh`: check Docker is running first, use `docker compose up -d --wait`, add `--monitoring` flag to start monitoring profile, run seed after schema push
- [ ] 4.2 Create `scripts/reset-dev.sh`: stop containers, remove volumes, restart — add as `pnpm dev:reset` in package.json

## 5. Environment

- [ ] 5.1 Create `.env.development.example` with documented defaults (DATABASE_URL, BROUTER_URL, JWT_SECRET, SESSION_SECRET) and add `.env.development` to `.gitignore`

## 6. Verify

- [ ] 6.1 Test full local dev flow: `pnpm dev:full` starts services, pushes schema, seeds data, launches apps — create session, compute route, verify seeded data visible
- [ ] 6.2 Test monitoring profile: `pnpm dev:full -- --monitoring` starts Prometheus + Grafana + Loki, verify Grafana dashboards load at localhost:3002
- [ ] 6.3 Test CI flow: push branch, verify e2e job uses compose, all ~20 E2E tests run (none skipped)
- [ ] 6.4 Test reset: `pnpm dev:reset` wipes volumes and restarts cleanly
