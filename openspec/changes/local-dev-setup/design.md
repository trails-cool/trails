## Context

The Planner app has server-side dependencies (PostgreSQL for sessions, BRouter
for routing) that aren't available when running `pnpm dev`. The app starts but
session creation and route computation fail. We need a local dev environment
that mirrors production dependencies.

## Goals / Non-Goals

**Goals:**
- One command to start the full local stack (DB + BRouter + apps)
- Database migrations run automatically
- BRouter has at least one segment for local route testing
- Works on macOS (primary dev platform)

**Non-Goals:**
- Full Germany segment coverage (too large for dev, one tile is enough)
- Production-like Caddy/Garage setup locally
- CI integration (CI doesn't need BRouter for current tests)

## Decisions

### D1: Extend docker-compose.dev.yml with BRouter

Add BRouter to the existing dev compose file. Use a named volume for segments
so they persist across restarts.

**Alternative**: Run BRouter natively (requires JVM). Rejected — Docker is
simpler and consistent.

### D2: Use a small test segment

Download one BRouter segment covering Berlin area (E10_N50.rd5, ~124MB) for
local testing. This is small enough to download quickly but covers a useful
area for route testing.

**Alternative**: Download all Germany (~750MB). Rejected — too slow for first
dev setup. Can always download more tiles manually.

### D3: Drizzle push for dev, migrations for production

Use `drizzle-kit push` in development (applies schema directly, no migration
files needed). Use `drizzle-kit migrate` in production.

**Alternative**: Always use migrations. Rejected — adds friction during rapid
schema iteration in dev.

### D4: Script-based orchestration

A shell script (`scripts/dev.sh`) starts Docker services, waits for health
checks, runs migrations, and starts the apps. The `pnpm dev:full` command
wraps this script.

**Alternative**: Use Docker Compose for everything including apps. Rejected —
we want Vite HMR for the apps, which works better running natively.

## Risks / Trade-offs

**[Docker required]** → Developers need Docker Desktop or OrbStack running.
Mitigation: Document in README prerequisites.

**[Segment download time]** → First run downloads ~124MB. Mitigation: Only
one tile, and it's cached in a Docker volume.
