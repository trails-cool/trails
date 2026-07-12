#!/bin/bash
# POI extract pipeline — runs on the dedicated BRouter host under the `trails`
# user (the box with 1.8 TB of disk). Downloads an OSM PBF, filters it to the
# planner's POI category selectors with osmium, reduces every element to a
# centroid, and publishes a compact NDJSON artifact + manifest that the
# flagship import job pulls over the vSwitch.
#
# Nothing here is planner/journal code — it's plain osmium + python so the host
# needs no Node runtime. The tag filter comes from `osmium-filters.txt`, which
# is generated from `@trails-cool/map-core`'s POI selectors (single source of
# truth; kept in sync by osmium-filters.sync.test.ts).
#
# Prerequisites on the host: osmium-tool, python3, curl, gzip, sha256sum.
#
# Usage:
#   ./poi-extract.sh
#
# Env:
#   POI_PBF_URL   OSM PBF to filter. Default: the full planet. A self-hoster or
#                 a dry run can point this at a Geofabrik regional extract, e.g.
#                 https://download.geofabrik.de/europe/germany-latest.osm.pbf
#   POI_WORK_DIR  Scratch dir for the (large, transient) planet download.
#                 Default: <script dir>/work
#   POI_PUBLISH_DIR  Where the artifact + manifest are written for Caddy to
#                 serve. Default: <script dir>/publish (mounted into the Caddy
#                 sidecar at /srv/poi — see docker-compose.yml + Caddyfile).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FILTERS_FILE="$SCRIPT_DIR/osmium-filters.txt"
TRANSFORMER="$SCRIPT_DIR/to-ndjson.py"

POI_PBF_URL="${POI_PBF_URL:-https://planet.osm.org/pbf/planet-latest.osm.pbf}"
POI_WORK_DIR="${POI_WORK_DIR:-$SCRIPT_DIR/work}"
POI_PUBLISH_DIR="${POI_PUBLISH_DIR:-$SCRIPT_DIR/publish}"

PLANET_PBF="$POI_WORK_DIR/planet.osm.pbf"
FILTERED_PBF="$POI_WORK_DIR/filtered.osm.pbf"
ARTIFACT="$POI_PUBLISH_DIR/pois.ndjson.gz"
MANIFEST="$POI_PUBLISH_DIR/manifest.json"

mkdir -p "$POI_WORK_DIR" "$POI_PUBLISH_DIR"

# Working files can be huge (planet PBF ~80 GB); always clean them up, even on
# failure, so a broken run can't fill the shared host's disk.
cleanup() { rm -f "$PLANET_PBF" "$FILTERED_PBF"; }
trap cleanup EXIT

log() { echo "[poi-extract] $*"; }

# --- 1. Read the tag filters (single source of truth: map-core) -------------
if [ ! -s "$FILTERS_FILE" ]; then
  echo "ERROR: $FILTERS_FILE missing/empty — regenerate with gen-osmium-filters.ts" >&2
  exit 1
fi
mapfile -t FILTERS < "$FILTERS_FILE"
log "tag filters: ${FILTERS[*]}"

# --- 2. Download the PBF -----------------------------------------------------
log "downloading $POI_PBF_URL"
curl --fail --location --show-error --silent --output "$PLANET_PBF" "$POI_PBF_URL"
log "downloaded $(du -h "$PLANET_PBF" | cut -f1)"

# --- 3. Filter to our categories --------------------------------------------
log "filtering with osmium tags-filter"
osmium tags-filter --overwrite --output "$FILTERED_PBF" "$PLANET_PBF" "${FILTERS[@]}"
log "filtered to $(du -h "$FILTERED_PBF" | cut -f1)"

# --- 4. Export to centroid NDJSON -------------------------------------------
# osmium export emits one GeoJSON feature per line; to-ndjson.py reduces each to
# a bbox centre + compact record and reports the row count on stderr.
log "exporting + transforming to NDJSON"
rowcount_file="$(mktemp)"
osmium export "$FILTERED_PBF" \
  --output-format=geojsonseq \
  --add-unique-id=type_id \
  --geometry-types=point,linestring,polygon \
  --overwrite --output - \
  | python3 "$TRANSFORMER" 2>"$rowcount_file" \
  | gzip -c > "$ARTIFACT"
ROW_COUNT="$(cat "$rowcount_file")"
rm -f "$rowcount_file"
log "wrote $ROW_COUNT rows -> $ARTIFACT ($(du -h "$ARTIFACT" | cut -f1))"

if [ "$ROW_COUNT" -eq 0 ]; then
  echo "ERROR: 0 rows produced — refusing to publish an empty artifact" >&2
  exit 1
fi

# --- 5. Manifest (checksum + timestamp + row count) -------------------------
SHA256="$(sha256sum "$ARTIFACT" | cut -d' ' -f1)"
GENERATED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
cat > "$MANIFEST" <<EOF
{
  "artifact": "pois.ndjson.gz",
  "sha256": "$SHA256",
  "row_count": $ROW_COUNT,
  "generated_at": "$GENERATED_AT",
  "source": "$POI_PBF_URL"
}
EOF
log "manifest written: $MANIFEST"
log "done"
