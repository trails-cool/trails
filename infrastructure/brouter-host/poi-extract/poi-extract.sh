#!/bin/bash
# POI extract pipeline — runs on the dedicated BRouter host under the `trails`
# user. Downloads an OSM PBF, filters it to the planner's POI category selectors
# with osmium, reduces every element to a centroid, and publishes a compact
# NDJSON artifact + manifest that the flagship import job pulls over the vSwitch.
#
# Nothing here is planner/journal code — the host needs no Node runtime. The tag
# filter comes from `osmium-filters.txt`, generated from `@trails-cool/map-core`
# POI selectors (single source of truth; kept in sync by
# osmium-filters.sync.test.ts).
#
# osmium runs in a container: the `trails` user is non-root with no sudo, so
# osmium-tool can't be apt-installed on the host, but docker-group rights are
# available. Big files are bind-mounted into the container, so I/O is native and
# the container adds no meaningful CPU overhead on Linux. The image is built on
# first use from osmium.Dockerfile. python3/curl/gzip/sha256sum run on the host.
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
#   OSMIUM_IMAGE  osmium container image. Default: trails-osmium:local (built
#                 on first use from osmium.Dockerfile).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FILTERS_FILE="$SCRIPT_DIR/osmium-filters.txt"
TRANSFORMER="$SCRIPT_DIR/to-ndjson.py"

POI_PBF_URL="${POI_PBF_URL:-https://planet.osm.org/pbf/planet-latest.osm.pbf}"
POI_WORK_DIR="${POI_WORK_DIR:-$SCRIPT_DIR/work}"
POI_PUBLISH_DIR="${POI_PUBLISH_DIR:-$SCRIPT_DIR/publish}"
OSMIUM_IMAGE="${OSMIUM_IMAGE:-trails-osmium:local}"

PLANET_PBF="$POI_WORK_DIR/planet.osm.pbf"
FILTERED_PBF="$POI_WORK_DIR/filtered.osm.pbf"
ARTIFACT="$POI_PUBLISH_DIR/pois.ndjson.gz"
MANIFEST="$POI_PUBLISH_DIR/manifest.json"

mkdir -p "$POI_WORK_DIR" "$POI_PUBLISH_DIR"

# Run osmium inside the container with the work dir bind-mounted at /data, as the
# host uid/gid so output files are owned by `trails`, not root. Big-file I/O goes
# through the bind mount (native), never the container's overlay layer.
osmium_run() {
  docker run --rm \
    -u "$(id -u):$(id -g)" \
    -v "$POI_WORK_DIR:/data" \
    "$OSMIUM_IMAGE" "$@"
}

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

# --- 2. Ensure the osmium image exists (build once from osmium.Dockerfile) ---
if ! docker image inspect "$OSMIUM_IMAGE" >/dev/null 2>&1; then
  log "building osmium image $OSMIUM_IMAGE"
  docker build -t "$OSMIUM_IMAGE" -f "$SCRIPT_DIR/osmium.Dockerfile" "$SCRIPT_DIR"
fi

# --- 3. Download the PBF -----------------------------------------------------
log "downloading $POI_PBF_URL"
curl --fail --location --show-error --silent --output "$PLANET_PBF" "$POI_PBF_URL"
log "downloaded $(du -h "$PLANET_PBF" | cut -f1)"

# --- 4. Filter to our categories --------------------------------------------
# Paths are inside the container's /data bind mount. tags-filter keeps the nodes
# referenced by matched ways/relations (default), so export can build geometry.
log "filtering with osmium tags-filter"
osmium_run tags-filter --overwrite --output /data/filtered.osm.pbf /data/planet.osm.pbf "${FILTERS[@]}"
log "filtered to $(du -h "$FILTERED_PBF" | cut -f1)"

# --- 5. Export to centroid NDJSON -------------------------------------------
# osmium export emits one GeoJSON feature per line to stdout (forwarded out of
# the container); to-ndjson.py reduces each to a bbox centre + compact record on
# the host and reports the row count on stderr.
log "exporting + transforming to NDJSON"
rowcount_file="$(mktemp)"
osmium_run export /data/filtered.osm.pbf \
  --output-format=geojsonseq \
  --add-unique-id=type_id \
  --geometry-types=point,linestring,polygon \
  --output - \
  | python3 "$TRANSFORMER" 2>"$rowcount_file" \
  | gzip -c > "$ARTIFACT"
ROW_COUNT="$(cat "$rowcount_file")"
rm -f "$rowcount_file"
log "wrote $ROW_COUNT rows -> $ARTIFACT ($(du -h "$ARTIFACT" | cut -f1))"

if [ "$ROW_COUNT" -eq 0 ]; then
  echo "ERROR: 0 rows produced — refusing to publish an empty artifact" >&2
  exit 1
fi

# --- 6. Manifest (checksum + timestamp + row count) -------------------------
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
