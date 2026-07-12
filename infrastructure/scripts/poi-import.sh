#!/bin/bash
# POI import — runs on the flagship. Pulls the POI artifact the BRouter host
# published, classifies each element into category rows, and swaps it into the
# live `planner.pois` table atomically. This is the "load where the database
# is" half of the poi-index change.
#
# Serving is never interrupted: the new data is built in a side table and the
# live table is replaced with a rename inside one transaction. A truncated
# download can never blank the map — the swap is refused if the fresh dataset
# has fewer than 70% of the live table's rows (override with --bootstrap on the
# very first import, when the live table is legitimately empty).
#
# Prerequisites: the live table must already exist (created empty by
# `pnpm db:push` from the Drizzle schema); curl, gunzip, sha256sum on the host.
#
# Usage:
#   ./poi-import.sh [--bootstrap]
#
# Env:
#   POI_ARTIFACT_BASE_URL   vSwitch URL of the published artifact dir.
#                           Default: http://10.0.1.10:17777/poi
#   BROUTER_AUTH_TOKEN      Shared secret Caddy requires (X-BRouter-Auth).
#   COMPOSE_FILE            docker compose file. Default: /opt/trails-cool/docker-compose.yml
#   NODE_EXPORTER_TEXTFILE_DIR  If set, an import-outcome .prom metric is written here.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SELECTORS_SQL="$SCRIPT_DIR/poi-selectors.sql"

POI_ARTIFACT_BASE_URL="${POI_ARTIFACT_BASE_URL:-http://10.0.1.10:17777/poi}"
COMPOSE_FILE="${COMPOSE_FILE:-/opt/trails-cool/docker-compose.yml}"
BOOTSTRAP=0
[ "${1:-}" = "--bootstrap" ] && BOOTSTRAP=1

WORK_DIR="$(mktemp -d)"
MANIFEST="$WORK_DIR/manifest.json"
ARTIFACT="$WORK_DIR/pois.ndjson.gz"
cleanup() { rm -rf "$WORK_DIR"; }
trap cleanup EXIT

log() { echo "[poi-import] $*"; }
psql() { docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U trails -d trails -v ON_ERROR_STOP=1 "$@"; }

emit_metric() {
  # Best-effort node_exporter textfile metric. status=1 success, 0 failure.
  local status="$1" rows="${2:-0}"
  [ -n "${NODE_EXPORTER_TEXTFILE_DIR:-}" ] || return 0
  local now; now="$(date +%s)"
  local tmp; tmp="$(mktemp)"
  {
    echo "# HELP poi_import_last_run_timestamp_seconds Unix time of the last POI import run."
    echo "# TYPE poi_import_last_run_timestamp_seconds gauge"
    echo "poi_import_last_run_timestamp_seconds $now"
    echo "# HELP poi_import_last_status 1 if the last POI import swapped successfully, else 0."
    echo "# TYPE poi_import_last_status gauge"
    echo "poi_import_last_status $status"
    echo "# HELP poi_import_last_rows Row count of the last successful POI import."
    echo "# TYPE poi_import_last_rows gauge"
    echo "poi_import_last_rows $rows"
    if [ "$status" = "1" ]; then
      echo "# HELP poi_import_last_success_timestamp_seconds Unix time of the last successful POI import."
      echo "# TYPE poi_import_last_success_timestamp_seconds gauge"
      echo "poi_import_last_success_timestamp_seconds $now"
    fi
  } > "$tmp"
  mv "$tmp" "$NODE_EXPORTER_TEXTFILE_DIR/poi_import.prom"
}

fail() { log "ERROR: $*"; emit_metric 0; exit 1; }

[ -s "$SELECTORS_SQL" ] || fail "$SELECTORS_SQL missing — regenerate with gen-poi-selectors-sql.ts"

AUTH_HEADER=()
[ -n "${BROUTER_AUTH_TOKEN:-}" ] && AUTH_HEADER=(-H "X-BRouter-Auth: ${BROUTER_AUTH_TOKEN}")

# --- 1. Fetch manifest + artifact over the vSwitch ---------------------------
log "fetching manifest from $POI_ARTIFACT_BASE_URL"
curl --fail --silent --show-error "${AUTH_HEADER[@]}" -o "$MANIFEST" "$POI_ARTIFACT_BASE_URL/manifest.json" \
  || fail "manifest fetch failed"
EXPECTED_SHA="$(grep -o '"sha256"[[:space:]]*:[[:space:]]*"[0-9a-f]*"' "$MANIFEST" | grep -o '[0-9a-f]\{64\}')"
MANIFEST_ROWS="$(grep -o '"row_count"[[:space:]]*:[[:space:]]*[0-9]*' "$MANIFEST" | grep -o '[0-9]*')"
[ -n "$EXPECTED_SHA" ] || fail "manifest has no sha256"
log "manifest: row_count=$MANIFEST_ROWS sha256=${EXPECTED_SHA:0:12}…"

log "fetching artifact"
curl --fail --silent --show-error "${AUTH_HEADER[@]}" -o "$ARTIFACT" "$POI_ARTIFACT_BASE_URL/pois.ndjson.gz" \
  || fail "artifact fetch failed"

# --- 2. Verify checksum ------------------------------------------------------
ACTUAL_SHA="$(sha256sum "$ARTIFACT" | cut -d' ' -f1)"
[ "$ACTUAL_SHA" = "$EXPECTED_SHA" ] || fail "checksum mismatch (got ${ACTUAL_SHA:0:12}…, want ${EXPECTED_SHA:0:12}…)"
log "checksum verified"

# --- 3. Load raw NDJSON into a staging import table --------------------------
log "loading raw NDJSON"
psql -c "CREATE TABLE IF NOT EXISTS planner.pois_raw_import (doc jsonb); TRUNCATE planner.pois_raw_import;"
# Each gzip line is one JSON object. Load it as a single column value using
# control-char delimiter/quote that never appear in JSON so the whole line
# lands intact, then it's cast to jsonb.
gunzip -c "$ARTIFACT" | psql -c \
  "\copy planner.pois_raw_import (doc) FROM STDIN WITH (FORMAT csv, DELIMITER E'\x1f', QUOTE E'\x1e')" \
  || fail "COPY failed"

# --- 4. Build the staging table, classified into category rows ---------------
# One transaction: temp selector table (from map-core) → pois_staging built
# LIKE the live table so structure/defaults match the Drizzle schema exactly →
# classified insert → indexes. The 70% guard + swap run in step 5.
log "building classified staging table"
psql <<SQL || fail "staging build failed"
BEGIN;
\\i $SELECTORS_SQL
DROP TABLE IF EXISTS planner.pois_staging;
CREATE TABLE planner.pois_staging (LIKE planner.pois INCLUDING DEFAULTS);
INSERT INTO planner.pois_staging (osm_type, osm_id, category, name, geom, tags, imported_at)
SELECT r.doc->>'osm_type',
       r.doc->>'osm_id',
       s.category,
       r.doc->>'name',
       ST_SetSRID(ST_MakePoint((r.doc->>'lon')::float8, (r.doc->>'lat')::float8), 4326),
       COALESCE(r.doc->'tags', '{}'::jsonb),
       now()
FROM planner.pois_raw_import r
JOIN poi_selector s ON r.doc->'tags'->>s.key = s.value;
ALTER TABLE planner.pois_staging
  ADD CONSTRAINT pois_staging_pkey PRIMARY KEY (osm_type, osm_id, category);
CREATE INDEX pois_staging_geom_idx ON planner.pois_staging USING gist (geom);
CREATE INDEX pois_staging_category_idx ON planner.pois_staging (category);
COMMIT;
SQL

STAGING_ROWS="$(psql -tA -c "SELECT count(*) FROM planner.pois_staging;")"
LIVE_ROWS="$(psql -tA -c "SELECT count(*) FROM planner.pois;")"
log "staging=$STAGING_ROWS live=$LIVE_ROWS bootstrap=$BOOTSTRAP"
[ "$STAGING_ROWS" -gt 0 ] || fail "staging is empty — refusing to swap"

# --- 5. 70% guard + atomic swap ---------------------------------------------
if [ "$BOOTSTRAP" -ne 1 ] && [ "$LIVE_ROWS" -gt 0 ]; then
  # Integer 70% threshold: staging * 100 >= live * 70
  if [ $(( STAGING_ROWS * 100 )) -lt $(( LIVE_ROWS * 70 )) ]; then
    fail "guard tripped: staging ($STAGING_ROWS) < 70% of live ($LIVE_ROWS). No swap. Use --bootstrap to override."
  fi
fi

log "swapping staging into live (atomic)"
psql <<'SQL' || fail "swap failed"
BEGIN;
DROP TABLE IF EXISTS planner.pois_old;
ALTER TABLE planner.pois RENAME TO pois_old;
ALTER TABLE planner.pois_staging RENAME TO pois;
-- Rename constraints/indexes to the canonical Drizzle names so a later
-- `db:push` sees no drift. pois_old still holds the old canonical names until
-- it's dropped, so free them first.
DROP TABLE planner.pois_old;
ALTER TABLE planner.pois RENAME CONSTRAINT pois_staging_pkey TO pois_osm_type_osm_id_category_pk;
ALTER INDEX planner.pois_staging_geom_idx RENAME TO pois_geom_idx;
ALTER INDEX planner.pois_staging_category_idx RENAME TO pois_category_idx;
COMMIT;
SQL

psql -c "DROP TABLE IF EXISTS planner.pois_raw_import;"
log "done: live table now has $STAGING_ROWS rows"
emit_metric 1 "$STAGING_ROWS"
