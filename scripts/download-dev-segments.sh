#!/bin/bash
set -euo pipefail

# Download a minimal BRouter segment for local development.
# E10_N50 covers the Berlin area (~124MB) — enough for route testing.

VOLUME_NAME="trails-cool_brouter_segments"
SEGMENT="E10_N50.rd5"
URL="https://brouter.de/brouter/segments4/${SEGMENT}"

# Check if segment already exists in the Docker volume
if docker run --rm -v "${VOLUME_NAME}:/data" alpine test -f "/data/${SEGMENT}" 2>/dev/null; then
  echo "✓ Segment ${SEGMENT} already exists, skipping download"
  exit 0
fi

echo "Downloading ${SEGMENT} (~124MB) for local development..."
docker run --rm -v "${VOLUME_NAME}:/data" alpine/curl \
  -L -o "/data/${SEGMENT}" "${URL}"

echo "✓ Segment downloaded to Docker volume ${VOLUME_NAME}"
