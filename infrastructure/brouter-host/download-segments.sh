#!/bin/bash
# Download / refresh BRouter RD5 segments from brouter.de for planet-wide
# coverage. Idempotent: re-running only fetches files that are new or
# updated upstream (wget -N uses Last-Modified). First run takes hours
# and pulls ~60–80 GB; subsequent runs are cheap.
#
# Usage:
#   ./download-segments.sh [dest_dir]
#   dest_dir defaults to ./segments relative to this script
#
# Runs safely as non-root; no privileged operations. Can be cron'd.
#
# After a successful run, restart the brouter container so it reloads
# any updated segments:
#   docker compose restart brouter

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST_DIR="${1:-$SCRIPT_DIR/segments}"
BASE_URL="https://brouter.de/brouter/segments4"

mkdir -p "$DEST_DIR"

echo "Listing tiles at $BASE_URL/ ..."
# Extract RD5 filenames from the Apache-style directory listing.
# Pattern matches the standard brouter tile naming: W120_N40.rd5 etc.
tiles=$(curl --fail --silent --show-error --location "$BASE_URL/" \
  | grep -oE '[WE][0-9]+_[NS][0-9]+\.rd5' \
  | sort -u)

if [ -z "$tiles" ]; then
  echo "ERROR: no tiles found at $BASE_URL/ (directory listing empty or blocked)" >&2
  exit 1
fi

total=$(printf '%s\n' "$tiles" | wc -l | tr -d ' ')
echo "Found $total tiles. Destination: $DEST_DIR"
echo

cd "$DEST_DIR"

i=0
skipped=0
failed=0
while read -r tile; do
  [ -z "$tile" ] && continue
  i=$((i + 1))
  # -N: only fetch if remote is newer than local (Last-Modified)
  # -q: quiet; we print our own progress
  if wget --no-verbose --timestamping --tries=3 --timeout=60 "$BASE_URL/$tile" 2>&1 | grep -q 'not retrieving'; then
    skipped=$((skipped + 1))
  fi
  if [ ! -s "$tile" ]; then
    echo "  [$i/$total] FAILED: $tile"
    failed=$((failed + 1))
  fi
  # Print heartbeat every 25 tiles so hour-long runs don't look hung
  if [ $((i % 25)) -eq 0 ]; then
    echo "  [$i/$total] ... $skipped already-current, $failed failed so far"
  fi
done <<< "$tiles"

echo
echo "Done. Totals:"
echo "  attempted: $i"
echo "  already current: $skipped"
echo "  failed: $failed"
echo
echo "Destination size:"
du -sh "$DEST_DIR"
echo
echo "Tile count on disk:"
ls "$DEST_DIR"/*.rd5 2>/dev/null | wc -l

if [ "$failed" -gt 0 ]; then
  echo
  echo "WARNING: $failed downloads failed. Re-run the script to retry." >&2
  exit 2
fi
