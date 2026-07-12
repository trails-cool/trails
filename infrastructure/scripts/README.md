# Flagship operational scripts

Deployed to `/opt/trails-cool/scripts/` by `cd-infra.yml`.

## `backup-postgres.sh`
Daily `pg_dump` + retention sweep. Run via cron (see the header).

## POI index import (`poi-import.sh`)

The "load where the database is" half of the [`poi-index`](../../openspec/changes/poi-index/)
change. Pulls the artifact the BRouter host published, classifies each element
into `planner.pois` category rows, and swaps it in atomically.

- `poi-import.sh` — fetch (vSwitch) → checksum → load → classify → **guarded
  atomic rename swap**. `--bootstrap` skips the 70% row-count guard for the
  first import (when the live table is legitimately empty).
- `poi-selectors.sql` — **generated** from `@trails-cool/map-core` selectors;
  the classifier JOINs on it. Regenerate with
  `npx tsx infrastructure/scripts/gen-poi-selectors-sql.ts` (CI sync test:
  `packages/map-core/src/poi-selectors-sql.sync.test.ts`).
- `poi-import.service` / `.timer` — monthly, offset a day after the extract.

### First-time setup on the flagship

```bash
# 1. Create the empty live table from the Drizzle schema (idempotent).
#    (Run from a checkout with DATABASE_URL pointed at production, or via the
#    normal db:push deploy path.)
pnpm db:push

# 2. Install the timer.
cp /opt/trails-cool/scripts/poi-import.{service,timer} /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now poi-import.timer

# 3. Bootstrap the first import (guard disabled — live table is empty).
BROUTER_AUTH_TOKEN=$(grep BROUTER_AUTH_TOKEN /opt/trails-cool/.env | cut -d= -f2-) \
  /opt/trails-cool/scripts/poi-import.sh --bootstrap
```

Prometheus picks up import outcome from node_exporter's textfile collector
(`poi_import_last_status`, `…_last_success_timestamp_seconds`, `…_last_rows`)
when `NODE_EXPORTER_TEXTFILE_DIR` is set (the unit sets it). Index size and age
are additionally exposed by the planner at `/metrics`
(`poi_index_rows{category}`, `poi_index_age_seconds`).
