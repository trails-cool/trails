## Context

Background work in trails.cool currently has no execution framework. The planner has an `expireSessions` function that is never called. The Komoot import feature (#223) implements ad-hoc background processing with no retries or failure visibility. Both apps already connect to PostgreSQL, making a Postgres-backed job queue the natural choice — no Redis or additional infrastructure needed.

pg-boss is a mature Node.js job queue that stores jobs as PostgreSQL rows, supports cron scheduling, automatic retries with exponential backoff, and exposes job state through queryable tables. Since Grafana already has a PostgreSQL datasource, observability comes for free.

## Goals / Non-Goals

**Goals:**
- Provide a durable job execution framework for both apps using the existing PostgreSQL database
- Wire up planner session expiry as the first scheduled job
- Make job queue health visible in Grafana
- Establish patterns for adding future jobs (Komoot import, ActivityPub federation, email sending)

**Non-Goals:**
- Refactoring the Komoot import to use pg-boss (separate change, after #223 merges)
- Multi-worker scaling or horizontal partitioning — single worker per app is sufficient at current scale
- Custom job queue UI — Grafana dashboards are sufficient

## Decisions

### 1. pg-boss over Graphile Worker
**Choice**: pg-boss
**Rationale**: Built-in cron scheduling, richer job metadata (completion timestamps, retry counts, output storage), and dead letter queue. Graphile Worker is lighter but lacks cron and has less queryable state for Grafana dashboards.
**Alternative considered**: Graphile Worker — faster raw throughput, but we need scheduling and observability more than throughput.

### 2. Shared package `@trails-cool/jobs`
**Choice**: New shared package at `packages/jobs/` that wraps pg-boss initialization and exports job registration helpers.
**Rationale**: Both planner and journal need background jobs. A shared package avoids duplicating pg-boss setup, ensures consistent configuration (retry policies, monitoring interval), and provides a single place to register job types.
**Alternative considered**: Inline setup in each app's `server.ts` — simpler initially but leads to divergent configuration.

### 3. Worker lifecycle in server process
**Choice**: Start the pg-boss worker inside each app's `server.ts` after the HTTP server is listening.
**Rationale**: Keeps deployment simple — no separate worker process or container. pg-boss workers are lightweight (polling loop). The planner and journal already run as long-lived Node.js processes.
**Alternative considered**: Separate worker container — better isolation but doubles container count and adds deployment complexity for minimal benefit at current scale.

### 4. Schema isolation
**Choice**: Let pg-boss use its default `pgboss` schema in the `trails` database.
**Rationale**: pg-boss auto-creates and migrates its own schema. Keeping it separate from `planner` and `journal` schemas avoids any collision. Grant `grafana_reader` SELECT access for dashboards.

### 5. Session expiry job
**Choice**: Cron job running hourly that calls the existing `expireSessions(7)` function.
**Rationale**: 7-day TTL with hourly cleanup is generous enough that no active session gets reaped, and frequent enough that stale sessions don't accumulate. The existing function already handles cleanup correctly (deletes DB rows + removes Yjs docs from memory).

## Risks / Trade-offs

- **pg-boss schema migrations on upgrade**: pg-boss manages its own schema and runs migrations on startup. → Mitigation: Pin pg-boss version, test upgrades in dev before deploying.
- **Worker blocks event loop**: A misbehaving job handler could block the HTTP server. → Mitigation: Jobs should be I/O-bound (DB queries), not CPU-bound. Add a timeout to job handlers.
- **Single worker per app**: No parallelism for heavy workloads. → Mitigation: Sufficient for current scale. Can add concurrency options per queue or separate workers later if needed.
- **Database load from polling**: pg-boss polls for jobs. → Mitigation: Default polling interval (2s) is fine for our scale. The queries are indexed and lightweight.
