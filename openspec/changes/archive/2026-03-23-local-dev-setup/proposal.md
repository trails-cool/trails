## Why

We can't test the Planner end-to-end locally. The Planner needs PostgreSQL
for session persistence and BRouter for route computation. Without a one-command
local dev setup, developers must manually run Docker containers and download
BRouter segments. This blocks iteration on Groups 5-6.

## What Changes

- Add a `pnpm dev:full` command that starts PostgreSQL, BRouter, and both apps
- Download a minimal BRouter segment for local testing (one tile)
- Run database migrations automatically on dev startup
- Seed data for quick testing (sample session with waypoints)
- Document local dev setup in README

## Capabilities

### New Capabilities

- `local-dev-environment`: One-command local development setup with PostgreSQL, BRouter, and both apps running together

### Modified Capabilities

(None)

## Impact

- **docker-compose.dev.yml**: Add BRouter service with segment volume
- **package.json**: New `dev:full` script
- **packages/db**: Add Drizzle migration runner
- **README.md**: Document local dev prerequisites and setup
