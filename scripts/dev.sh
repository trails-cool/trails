#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Parse flags
MONITORING=false
for arg in "$@"; do
  case "$arg" in
    --monitoring) MONITORING=true ;;
  esac
done

# Check Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "Error: Docker is not running. Please start Docker and try again."
  exit 1
fi

echo "=== trails.cool dev environment ==="
echo ""

# 1. Start Docker services
if [ "$MONITORING" = "true" ]; then
  echo "Starting Docker services (with monitoring)..."
  docker compose -f docker-compose.dev.yml --profile monitoring up -d --wait
else
  echo "Starting Docker services..."
  docker compose -f docker-compose.dev.yml up -d --wait
fi
echo "✓ Services are ready"

# 2. Push database schema
echo "Pushing database schema..."
pnpm db:push 2>&1 | tail -3
echo "✓ Database schema up to date"

# 3. Seed database
echo "Seeding database..."
pnpm db:seed
echo "✓ Database seeded"

# 4. Download BRouter segments if needed
echo "Checking BRouter segments..."
"$SCRIPT_DIR/download-dev-segments.sh"

echo ""
echo "=== Starting apps ==="
echo "  Journal:  http://localhost:3000"
echo "  Planner:  http://localhost:3001"
echo "  BRouter:  http://localhost:17777"
if [ "$MONITORING" = "true" ]; then
  echo "  Grafana:  http://localhost:3002"
  echo "  Prometheus: http://localhost:9090"
fi
echo ""
echo "  Tip: pnpm dev:reset to wipe all data and start fresh"
echo ""

# 5. Start both apps with turbo
exec pnpm dev
