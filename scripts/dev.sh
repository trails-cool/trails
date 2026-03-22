#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "=== trails.cool dev environment ==="
echo ""

# 1. Start Docker services
echo "Starting Docker services..."
docker compose -f docker-compose.dev.yml up -d

# 2. Wait for PostgreSQL
echo "Waiting for PostgreSQL..."
until docker compose -f docker-compose.dev.yml exec -T postgres pg_isready -U trails > /dev/null 2>&1; do
  sleep 1
done
echo "✓ PostgreSQL is ready"

# 3. Push database schema
echo "Pushing database schema..."
pnpm db:push 2>&1 | tail -3
echo "✓ Database schema up to date"

# 4. Download BRouter segments if needed
echo "Checking BRouter segments..."
"$SCRIPT_DIR/download-dev-segments.sh"

# 5. Wait for BRouter (if segments are available)
if docker compose -f docker-compose.dev.yml ps brouter --format '{{.State}}' 2>/dev/null | grep -q "running"; then
  echo "Waiting for BRouter..."
  for i in $(seq 1 30); do
    if curl -sf http://localhost:17777/brouter?lonlats=13.4,52.5\|13.5,52.5\&profile=trekking\&format=geojson > /dev/null 2>&1; then
      echo "✓ BRouter is ready"
      break
    fi
    if [ "$i" = "30" ]; then
      echo "⚠ BRouter not responding (segments may still be loading). Continuing..."
    fi
    sleep 2
  done
fi

echo ""
echo "=== Starting apps ==="
echo "  Journal:  http://localhost:3000"
echo "  Planner:  http://localhost:3001"
echo "  BRouter:  http://localhost:17777"
echo ""

# 6. Start both apps with turbo
exec pnpm dev
