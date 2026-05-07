#!/bin/bash
set -euo pipefail

SEGMENTS_DIR="/data/segments"

# Auto-populate segments on first start. The named volume is empty after
# `docker compose up`, which leaves BRouter returning 400 for every routing
# request. Downloading here means a fresh checkout works end-to-end without
# extra setup steps. On subsequent starts the rd5 files are already present
# and we skip straight to the server.
if ! ls "$SEGMENTS_DIR"/*.rd5 >/dev/null 2>&1; then
  echo "No segments found in $SEGMENTS_DIR — downloading…"
  /brouter/download-segments.sh "$SEGMENTS_DIR"
fi

exec "$@"
