#!/usr/bin/env bash
# Two-instance federation harness runner (social-federation 11.4).
#
#   ./e2e/federation/run.sh            # build, test, tear down
#   KEEP_STACK=1 ./e2e/federation/run.sh   # leave the stack up for poking
#
# Brings up two journal instances that federate with each other (see
# docker-compose.yml), pushes the Drizzle schema into both databases,
# and runs the driver test. Opt-in and self-contained — nothing here is
# wired into `pnpm test` or CI.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
compose() { docker compose -f "$SCRIPT_DIR/docker-compose.yml" "$@"; }

cleanup() {
  if [[ "${KEEP_STACK:-}" == "1" ]]; then
    echo "KEEP_STACK=1 — leaving the stack up. Tear down with:"
    echo "  docker compose -f $SCRIPT_DIR/docker-compose.yml down -v"
  else
    compose down -v --remove-orphans >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

echo "==> postgres + caddy (internal CA)"
compose up -d --wait postgres caddy

echo "==> pushing schema into trails_a and trails_b"
push_schema() {
  # A transient postgres backend crash mid-introspection has been seen
  # under Docker Desktop load ("Connection terminated unexpectedly" +
  # crash recovery). Retry after the healthcheck reports the server
  # recovered — without hiding a deterministic failure.
  local url="$1" attempt
  for attempt in 1 2 3; do
    if DATABASE_URL="$url" pnpm --dir "$ROOT" db:push; then return 0; fi
    echo "schema push failed (attempt $attempt) — waiting for postgres to recover"
    sleep 5
    compose up -d --wait postgres
  done
  return 1
}
push_schema postgres://trails:trails@127.0.0.1:5499/trails_a
push_schema postgres://trails:trails@127.0.0.1:5499/trails_b

echo "==> building the journal image (slow on first run)"
compose build journal-a

echo "==> journal-a + journal-b"
compose up -d --wait journal-a journal-b

echo "==> driving the federation flow"
FEDERATION_TWO_INSTANCE=1 pnpm --dir "$ROOT/apps/journal" exec vitest run app/lib/federation-two-instance.integration.test.ts
