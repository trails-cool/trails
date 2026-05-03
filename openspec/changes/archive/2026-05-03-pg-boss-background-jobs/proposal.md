## Why

Background work (session expiry, Komoot activity imports) currently has no durable execution mechanism. Session cleanup exists as dead code (`expireSessions`) that is never called, and the Komoot import in #223 rolls its own ad-hoc background processing without retries or failure handling. Adding pg-boss gives us a PostgreSQL-backed job queue with scheduling, retries, and observability through our existing Grafana stack — no new infrastructure required.

## What Changes

- Add `pg-boss` as a dependency to both the Planner and Journal apps
- Create a shared background worker setup in `@trails-cool/db` (or a new `@trails-cool/jobs` package) that initializes pg-boss with the existing `DATABASE_URL`
- Wire up **planner session expiry** as the first recurring job (hourly cron, 7-day TTL)
- Wire up **Komoot import processing** as a durable job with retries (replaces ad-hoc background processing in #223)
- Grant `grafana_reader` SELECT on the `pgboss` schema for dashboard visibility
- Add a Grafana dashboard panel for job queue health (queue depth, failed jobs, processing duration)

## Capabilities

### New Capabilities
- `background-jobs`: pg-boss job queue setup, worker lifecycle, job registration, cron scheduling, retry policies, and Grafana observability

### Modified Capabilities
- `planner-session`: Session expiry is now handled by a scheduled pg-boss job instead of being uncalled dead code
- `infrastructure`: PostgreSQL init script grants `grafana_reader` access to the `pgboss` schema; Grafana gets a job queue health panel

## Impact

- **Dependencies**: Adds `pg-boss` npm package
- **Database**: pg-boss auto-creates its schema (`pgboss`) in PostgreSQL on first run
- **Apps**: Both planner and journal server entry points start a pg-boss worker
- **Monitoring**: New Grafana panel on Service Health dashboard for job queue metrics
- **Komoot import (#223)**: Will be refactored to use pg-boss instead of ad-hoc background processing
