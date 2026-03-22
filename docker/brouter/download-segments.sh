#!/bin/bash
set -euo pipefail

# Download Germany RD5 segments from brouter.de
# These 4 tiles cover all of Germany:
#   E5_N45  = Southwest (Frankfurt, Stuttgart, Black Forest)
#   E5_N50  = Northwest (Hamburg, Bremen, Ruhr)
#   E10_N45 = Southeast (Munich, Nuremberg, Bavaria)
#   E10_N50 = Northeast (Berlin, Leipzig, Dresden)

SEGMENTS_DIR="${1:-/data/segments}"
BASE_URL="https://brouter.de/brouter/segments4"

TILES=(
  "E5_N45"
  "E5_N50"
  "E10_N45"
  "E10_N50"
)

mkdir -p "$SEGMENTS_DIR"

for tile in "${TILES[@]}"; do
  file="${SEGMENTS_DIR}/${tile}.rd5"
  url="${BASE_URL}/${tile}.rd5"

  if [ -f "$file" ]; then
    echo "Updating ${tile}.rd5 (checking for newer version)..."
    wget -N -q -P "$SEGMENTS_DIR" "$url" || echo "  No update available or download failed"
  else
    echo "Downloading ${tile}.rd5..."
    wget -q -P "$SEGMENTS_DIR" "$url"
  fi
done

echo ""
echo "Segments downloaded to ${SEGMENTS_DIR}:"
ls -lh "${SEGMENTS_DIR}"/*.rd5 2>/dev/null || echo "  No segments found"
