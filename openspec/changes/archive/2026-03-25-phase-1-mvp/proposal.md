## Why

trails.cool needs its foundation: a working Planner for collaborative route
editing and a Journal for managing routes and activities. Without Phase 1,
nothing can be tested or shown to users. The architecture plan is finalized
(see docs/architecture.md) — now we need a working MVP to validate the
product-market fit with 100 European users, primarily in Germany.

## What Changes

- Set up the monorepo build toolchain (Turborepo, pnpm, TypeScript, React Router 7, Tailwind)
- Build the Planner app: real-time collaborative route editing via Yjs, BRouter integration for route computation, Leaflet map with OSM tiles, session sharing via link, GPX export
- Build the Journal app: user accounts, route CRUD, start Planner sessions from routes via callback, GPX import/export, basic profile page, activity feed
- Deploy BRouter as a Docker service with Germany RD5 segments (~750 MB)
- Set up infrastructure as code (Terraform + Docker Compose) for Hetzner Cloud
- Establish shared packages: types, UI components, map utilities, GPX parsing, i18n

## Capabilities

### New Capabilities

- `planner-session`: Collaborative route editing sessions with Yjs CRDTs, shareable links, guest access, session lifecycle (create, join, save, close, expire)
- `brouter-integration`: BRouter HTTP API wrapper, routing host election, route computation from waypoints, profile selection (bike/hike)
- `map-display`: Leaflet map with OSM/OpenTopoMap/CyclOSM base layers, waypoint editing, route visualization, elevation profile display
- `journal-auth`: User accounts with federated identity structure (@user@instance), registration, login, profile pages
- `route-management`: Route CRUD, GPX import/export, route metadata envelope, PostGIS spatial storage, route versioning (sequential)
- `planner-journal-handoff`: Callback-based integration between Journal and Planner — open Planner from route, save GPX back via scoped JWT token
- `activity-feed`: Activity CRUD, activity feed (own activities), link activities to routes (1:N blueprint model)
- `shared-packages`: Monorepo shared packages — @trails-cool/types, @trails-cool/ui, @trails-cool/map, @trails-cool/gpx, @trails-cool/i18n
- `infrastructure`: Terraform for Hetzner Cloud, Docker Compose for services, CI/CD via GitHub Actions

### Modified Capabilities

(None — this is the initial build, no existing capabilities to modify.)

## Impact

- **New apps**: `apps/planner` and `apps/journal` (React Router 7)
- **New packages**: `packages/types`, `packages/ui`, `packages/map`, `packages/gpx`, `packages/i18n`
- **Infrastructure**: Hetzner CX21 server, PostgreSQL + PostGIS, Garage (S3), BRouter Docker container
- **External dependencies**: React Router 7, Yjs, Leaflet, Fedify (stub for Phase 1), BRouter (Java), Tailwind CSS, react-i18next
- **Data**: Germany RD5 segments from brouter.de (~750 MB), PostgreSQL schemas (planner.*, activity.*)
- **Domains**: trails.cool (Journal), planner.trails.cool (Planner)
