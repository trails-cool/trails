# Conversation Log — 2026-03-22

Initial architecture exploration and planning session for trails.cool.

## Context

This conversation started in the BRouter repository (`/Users/ullrich/Projects/brouter`)
with the goal of understanding BRouter's routing library and evaluating how to reuse
it in a new collaborative route planning project.

## What We Did

### 1. BRouter Codebase Exploration

Analyzed the BRouter project structure to understand reusability:

- **Core routing engine**: Pure Java, zero Android dependencies in core modules
- **Algorithm**: Bidirectional Dijkstra with A* heuristics (`RoutingEngine.java:1890`)
- **Data format**: Custom RD5 binary tiles (5x5 degree geographic regions)
- **Key modules**: `brouter-core`, `brouter-mapaccess`, `brouter-expressions`, `brouter-server`
- **Web portability**: Excellent — no JNI, no native code, minimal dependencies
- **Reuse options**: WASM compilation (TeaVM), TypeScript port, or HTTP API wrapper

### 2. Map Data Analysis

- Segments hosted at https://brouter.de/brouter/segments4/ (updated weekly)
- **Germany coverage**: 4-6 tiles, ~750 MB-1 GB
- **Europe coverage**: ~3 GB
- Tile system: 5x5 degree grid, named by southwest corner (e.g., `E5_N45.rd5`)

### 3. Architecture Planning

Developed the full architecture through 4 rounds of crit review (50 comments resolved):

**Round 1** (10 comments): Resolved foundational questions — versioning model,
route mirroring, cross-instance edits, session lifetime, tech stack choices
(React Router 7, Fedify, PostGIS).

**Round 2** (32 comments): Product naming, privacy philosophy, multi-day route
design (isDayBreak markers), Minio→Garage, self-hosted stack parity, permission
matrix, monorepo structure, JWT auth, rate limiting, map tiles, monitoring.

**Round 3** (8 comments): Finalized names (Planner + Journal), added project
philosophy section (privacy, data ownership, MIT, AI-assisted dev, i18n),
activity sharing & participants, monorepo apps/packages split.

**Round 4** (0 comments): Architecture approved.

### 4. Key Decisions Made

1. **Two products**: Planner (stateless, Yjs) + Journal (stateful, ActivityPub)
2. **Tech stack**: React + Tailwind + React Router 7 + Yjs + Fedify + PostgreSQL/PostGIS + Garage
3. **Monorepo**: `apps/` (planner, journal) + `packages/` (ui, types, map, gpx, i18n)
4. **BRouter**: Wrapped as HTTP API in Docker, Germany segments first
5. **Privacy-first**: Planner collects no user data, Journal has privacy manifest
6. **Federation**: ActivityPub via Fedify, Mastodon-compatible activities
7. **Self-hostable**: Journal via Docker Compose, uses trails.cool Planner by default
8. **Routing host**: Session initiator, failover via Yjs awareness
9. **Auth**: Scoped JWT tokens for Planner-Journal callback
10. **Permissions**: Simple view + edit, owner can share session links to anyone

### 5. Monorepo Creation

- Created `github.com/trails-cool/trails` with monorepo structure
- Initialized OpenSpec with `phase-1-mvp` change
- Generated all artifacts: proposal, design, 9 capability specs, 74 tasks

## Artifacts Produced

- `docs/architecture.md` — Full architecture plan (19 resolved decisions)
- `openspec/changes/phase-1-mvp/proposal.md` — Why and what
- `openspec/changes/phase-1-mvp/design.md` — Technical decisions
- `openspec/changes/phase-1-mvp/specs/` — 9 capability specs with WHEN/THEN scenarios
- `openspec/changes/phase-1-mvp/tasks.md` — 74 implementation tasks

## Open Items for Next Session

1. Multi-day activity collections data model (TBD)
2. Review brouter-web dependencies for proven library choices
3. Start implementation via `/opsx:apply`
