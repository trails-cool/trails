#!/bin/bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

if ! docker info > /dev/null 2>&1; then
  echo "Error: Docker is not running. Please start Docker and try again."
  exit 1
fi

echo "=== Resetting dev environment ==="
echo "This will stop all containers and wipe all local data volumes."
echo ""

read -r -p "Are you sure? [y/N] " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
  echo "Aborted."
  exit 0
fi

echo "Stopping containers and removing volumes..."
docker compose -f docker-compose.dev.yml --profile monitoring down -v 2>/dev/null || \
  docker compose -f docker-compose.dev.yml down -v

echo "✓ Done. Run 'pnpm dev:full' to start fresh."
