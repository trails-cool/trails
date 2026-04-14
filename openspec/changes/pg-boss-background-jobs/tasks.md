## 1. Package Setup

- [x] 1.1 Create `packages/jobs/` package with `package.json`, `tsconfig.json`, and `pg-boss` dependency
- [x] 1.2 Add `@trails-cool/jobs` to planner and journal app dependencies in `pnpm-workspace.yaml`
- [x] 1.3 Run `pnpm install` and verify workspace resolution

## 2. Core Job Queue Module

- [x] 2.1 Create `packages/jobs/src/boss.ts` — initialize pg-boss with `DATABASE_URL`, export `createBoss()` factory
- [x] 2.2 Create `packages/jobs/src/worker.ts` — export `startWorker(boss, jobs)` that registers job handlers and starts processing
- [x] 2.3 Create `packages/jobs/src/types.ts` — export `JobDefinition` type (name, handler, cron?, retryLimit?, expireInSeconds?)
- [x] 2.4 Add graceful shutdown: listen for SIGTERM, call `boss.stop()` to complete in-progress jobs before exit
- [x] 2.5 Export public API from `packages/jobs/src/index.ts`

## 3. Planner Session Expiry Job

- [x] 3.1 Create `apps/planner/app/jobs/expire-sessions.ts` — job handler that calls `expireSessions(7)` and returns the count
- [x] 3.2 Register the job in planner's `server.ts` with cron `0 * * * *` (hourly), retryLimit 2, expireInSeconds 60
- [ ] 3.3 Verify job appears in `pgboss.schedule` table after planner starts (manual verification after dev stack is running)
- [x] 3.4 Write a test for the expire-sessions handler

## 4. Journal Worker Setup

- [x] 4.1 Add pg-boss worker startup to journal's `server.ts` (no jobs yet — placeholder for Komoot import and future federation jobs)
- [x] 4.2 Add graceful shutdown handling (handled by startWorker via SIGTERM/SIGINT listeners)

## 5. Infrastructure & Observability

- [x] 5.1 Add `GRANT USAGE ON SCHEMA pgboss TO grafana_reader` and `GRANT SELECT ON ALL TABLES IN SCHEMA pgboss TO grafana_reader` to `infrastructure/postgres/init-grafana-user.sql`
- [x] 5.2 Add a "Job Queue Health" panel to the Service Health Grafana dashboard — queue depth (`SELECT state, count(*) FROM pgboss.job GROUP BY state`), failed jobs, and completed jobs/hour
- [x] 5.3 Add a Grafana alert for failed background jobs (`SELECT count(*) FROM pgboss.job WHERE state = 'failed' AND completedon > now() - interval '1 hour'`)

## 6. Testing & Verification

- [x] 6.1 Run `pnpm typecheck` — all packages pass
- [x] 6.2 Run `pnpm test` — new and existing tests pass (63 planner tests, including 2 new expire-sessions tests)
- [ ] 6.3 Start dev stack with `pnpm dev:full`, verify pg-boss tables are created and expire-sessions schedule is registered (manual verification)
