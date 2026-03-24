## 1. Monorepo Toolchain Setup

- [x] 1.1 Install pnpm and Turborepo, configure workspaces
- [x] 1.2 Set up TypeScript config (base tsconfig, per-package extends)
- [x] 1.3 Set up Tailwind CSS (shared config, content paths for monorepo)
- [x] 1.4 Set up ESLint and Prettier (shared config)
- [x] 1.5 Scaffold Planner app with React Router 7 (`apps/planner`)
- [x] 1.6 Scaffold Journal app with React Router 7 (`apps/journal`)
- [x] 1.7 Verify `turbo dev` starts both apps and `turbo build` succeeds

## 2. Shared Packages

- [x] 2.1 Implement `@trails-cool/types` — Route, Activity, Waypoint, RouteVersion, RouteMetadata interfaces
- [x] 2.2 Implement `@trails-cool/gpx` — GPX parser (XML → waypoints/tracks/elevation) and GPX generator (waypoints/tracks → XML)
- [x] 2.3 Implement `@trails-cool/map` — MapView React component (Leaflet + OSM), RouteLayer component (GeoJSON polyline), layer switcher (OSM/OpenTopoMap/CyclOSM)
- [x] 2.4 Implement `@trails-cool/ui` — Button, Input, Card, Layout components with Tailwind styling
- [x] 2.5 Implement `@trails-cool/i18n` — react-i18next config, English + German translation files, LanguageSwitcher component
- [x] 2.6 Verify all packages are importable from both apps

## 3. Infrastructure

- [x] 3.1 Create Terraform config for Hetzner CX21 with Docker installed
- [x] 3.2 Create Docker Compose for all services (Journal, Planner, BRouter, PostgreSQL+PostGIS, Garage)
- [x] 3.3 Create BRouter Dockerfile with segment volume mount
- [x] 3.4 Create segment download script (Germany: E5_N45, E5_N50, E10_N45, E10_N50)
- [x] 3.5 Configure DNS for trails.cool and planner.trails.cool with TLS (Caddy)
- [x] 3.6 Set up GitHub Actions CI pipeline (build, typecheck, lint, unit tests, e2e)
- [x] 3.7 Set up GitHub Actions CD pipeline (build Docker images, push to ghcr.io, deploy to Hetzner)
- [x] 3.8 Set up PostgreSQL backup cron (daily pg_dump to Hetzner Storage Box)

## 4. Planner — Session Management

- [x] 4.1 Set up Yjs with y-websocket in Planner backend (WebSocket endpoint at /sync)
- [x] 4.2 Implement Yjs persistence to PostgreSQL (planner schema, sessions table)
- [x] 4.3 Implement session creation endpoint (POST /api/sessions → returns session ID)
- [x] 4.4 Implement session creation with initial GPX (parse GPX → Yjs document with waypoints)
- [x] 4.5 Implement session join page (GET /session/:id → connect to Yjs document)
- [x] 4.6 Implement session expiry (garbage collection cron, configurable TTL)
- [x] 4.7 Implement manual session close (owner action, notify participants)

## 5. Planner — BRouter Integration

- [x] 5.1 Implement BRouter HTTP proxy endpoint (POST /api/route → forward to BRouter)
- [x] 5.2 Implement rate limiting middleware (60 requests/session/hour)
- [x] 5.3 Implement routing host election via Yjs awareness (host/participant roles)
- [x] 5.4 Implement routing host failover (detect disconnect, elect new host by join timestamp)
- [x] 5.5 Implement route computation trigger (host watches waypoint changes, debounce 500ms, call BRouter)
- [x] 5.6 Implement route broadcast (host stores GeoJSON result in Y.Map, syncs to all)
- [x] 5.7 Implement profile selection (sync profile choice via Y.Map, trigger recompute)

## 6. Planner — Map UI

- [x] 6.1 Integrate MapView component in Planner with full-screen layout and client-side Yjs connection
- [x] 6.1a Implement user presence display (Yjs awareness, colors, names, live map cursors)
- [x] 6.2 Implement waypoint add (click map → add to Y.Array)
- [x] 6.3 Implement waypoint drag (move marker → update Y.Array)
- [x] 6.4 Implement waypoint delete (right-click → remove from Y.Array)
- [x] 6.5 Implement waypoint list sidebar (draggable reorder, synced with Y.Array)
- [x] 6.6 Implement route polyline display (render GeoJSON from Y.Map)
- [x] 6.7 Implement elevation profile chart (parse elevation from route GeoJSON, render chart)
- [x] 6.8 Implement profile selector UI (dropdown, synced via Y.Map)
- [x] 6.9 Implement GPX export button (generate GPX from current waypoints and route)

## 7. Journal — Auth

- [x] 7.1 Update DB schema: remove password_hash from users, add credentials table (WebAuthn) and magic_tokens table
- [x] 7.2 Implement passkey registration flow (email + username → WebAuthn create → account created)
- [x] 7.3 Implement passkey login flow (WebAuthn get → session created)
- [x] 7.4 Implement magic link request (POST /api/auth/magic-link → send email with token)
- [x] 7.5 Implement magic link verification (GET /auth/verify?token=... → session created)
- [x] 7.6 Implement "Add passkey" prompt after magic link login on new device
- [x] 7.7 Implement session middleware (validate cookie, load user in loader context)
- [x] 7.8 Implement logout (POST /api/auth/logout, invalidate session)
- [x] 7.9 Implement user profile page (GET /users/:username)
- [x] 7.10 Store federated identity format (@user@domain) in user record

## 8. Journal — Route Management

- [x] 8.1 Set up PostgreSQL schema (journal.routes table with PostGIS geometry column, journal.route_versions table)
- [x] 8.2 Implement route creation page (form: name, description, optional GPX upload)
- [x] 8.3 Implement route detail page (map, metadata, version history)
- [x] 8.4 Implement route edit page (update name, description)
- [x] 8.5 Implement route deletion (with confirmation dialog)
- [x] 8.6 Implement GPX import (parse GPX, extract geometry for PostGIS, compute stats)
- [x] 8.7 Implement GPX export (generate GPX from stored data, download)
- [x] 8.8 Implement route versioning (create new version on each GPX update)
- [x] 8.9 Implement route list page (user's routes, sorted by last updated)
- [x] 8.10 Implement route metadata computation (distance, elevation gain/loss from GPX)

## 9. Planner-Journal Handoff

- [x] 9.1 Implement JWT token generation in Journal (scoped to route_id, with expiry)
- [x] 9.2 Implement "Edit in Planner" button on Journal route detail page (redirect with callback + token + GPX)
- [x] 9.3 Implement callback URL handling in Planner (store callback URL in session metadata)
- [x] 9.4 Implement "Save to Journal" button in Planner (POST GPX + JWT to callback URL)
- [x] 9.5 Implement callback endpoint in Journal (POST /api/routes/:id/callback — validate JWT, save new version)
- [x] 9.6 Implement "Return to Journal" link after successful save

## 10. Journal — Activity Feed

- [ ] 10.1 Set up PostgreSQL schema (journal.activities table with route_id FK, gpx, stats)
- [ ] 10.2 Implement activity creation page (GPX upload, description, optional route link)
- [ ] 10.3 Implement activity detail page (map with GPS trace, stats, description)
- [ ] 10.4 Implement activity feed page (chronological list of own activities)
- [ ] 10.5 Implement "Link to Route" action (select existing route to link)
- [ ] 10.6 Implement "Create Route from Activity" action (create route from activity GPX)

## 11. Testing & Polish

- [ ] 11.1 End-to-end test: Create route in Journal → Edit in Planner → Save back to Journal
- [ ] 11.2 End-to-end test: Two users collaboratively edit waypoints in Planner
- [ ] 11.3 End-to-end test: Import GPX → view route on map → export GPX
- [ ] 11.4 Test BRouter routing with Germany segments (Berlin → Munich route)
- [ ] 11.5 Test session expiry and manual close
- [ ] 11.6 Verify i18n works (English and German)
- [ ] 11.7 Basic responsive layout testing (desktop, tablet)
- [ ] 11.8 Deploy to Hetzner and verify production setup
