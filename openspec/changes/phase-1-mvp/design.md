## Context

trails.cool is a new platform with two apps: a collaborative route Planner and
a federated activity Journal. The full architecture is documented in
docs/architecture.md with 19 resolved design decisions. Phase 1 builds the
foundation — both apps with minimal features, shared packages, and deployment
infrastructure.

The Planner is stateless and ephemeral — it runs collaborative editing sessions
via Yjs and computes routes via BRouter. The Journal is stateful — it stores
user accounts, routes, and activities in PostgreSQL with PostGIS.

Both apps share a TypeScript/React stack (React Router 7, Tailwind) and are
deployed to a single Hetzner CX21 server via Docker Compose.

## Goals / Non-Goals

**Goals:**
- Working Planner with collaborative waypoint editing and BRouter route computation
- Working Journal with user accounts, route CRUD, and activity feed
- Seamless handoff between Journal and Planner (open route in Planner, save back)
- Shared packages for types, UI components, map rendering, GPX parsing, i18n
- Deployable to Hetzner via Terraform + Docker Compose
- Germany map coverage (~750 MB RD5 segments)

**Non-Goals:**
- ActivityPub federation (Phase 2)
- Following/followers, likes, comments (Phase 2)
- Photo attachments (Phase 2)
- Route sharing permissions beyond basic CRUD (Phase 2)
- Mobile app or offline support (Phase 3)
- Multi-day route planning UI (Phase 3)
- WASM compilation of BRouter (Phase 3)
- Monitoring stack (Grafana/Prometheus — add when needed)

## Decisions

### D1: React Router 7 for both apps

Both Planner and Journal use React Router 7 (Remix stack) as their full-stack
framework. This gives SSR for Journal (SEO, initial load), API routes, and
loader/action patterns.

**Alternative considered**: Separate frameworks (e.g., Next.js for Journal, Vite
SPA for Planner). Rejected because maintaining two frameworks doubles learning
curve and prevents sharing server-side code patterns.

### D2: BRouter wrapped as HTTP proxy in Planner backend

The Planner's React Router 7 server proxies BRouter API calls. Clients never
talk to BRouter directly. This allows rate limiting, request validation, and
later caching at the proxy layer.

**Alternative considered**: Expose BRouter directly. Rejected because BRouter
has no built-in auth, rate limiting, or CORS support.

### D3: Yjs with y-websocket for CRDT sync

Use y-websocket for the Planner's real-time sync. The WebSocket server runs
as part of the Planner's Node.js process (not a separate service). Yjs documents
are persisted to PostgreSQL for crash recovery.

**Alternative considered**: Separate y-websocket service. Rejected for Phase 1
simplicity — one process is easier to deploy and debug. Can extract later.

### D4: PostgreSQL shared instance, separate schemas

One PostgreSQL instance with two schemas:
- `planner` — Yjs session documents, session metadata
- `journal` — users, routes, activities, media references

**Alternative considered**: Separate PostgreSQL instances. Rejected — unnecessary
overhead for 100 users. Single instance is simpler to backup and manage.

### D5: Routing host election via Yjs awareness

Only one client per session talks to BRouter (the "routing host"). The host is
the session initiator; on disconnect, the longest-connected client takes over.
This avoids redundant BRouter API calls.

**Alternative considered**: Server-side route computation (Planner backend
watches Yjs changes and computes routes). Better long-term but more complex.
Client-side host election is simpler for Phase 1.

### D6: Scoped JWT for Planner-Journal callback

When the Journal opens a Planner session, it generates a scoped JWT token
embedded in the callback URL. The Planner sends this JWT when saving GPX back.
The Journal validates the JWT signature to authorize the write.

**Alternative considered**: Session cookies / OAuth flow. Rejected — the Planner
is stateless and doesn't have access to the Journal's session.

### D7: Leaflet with plugin-based layers

Leaflet (not Mapbox GL) for map rendering. Leaflet is lighter, has no API key
requirement, and has mature plugin ecosystem for OSM tiles.

**Alternative considered**: Mapbox GL JS. Rejected — requires API key, larger
bundle, and commercial license for heavy usage.

### D8: pnpm + Turborepo for monorepo

pnpm workspaces for dependency management, Turborepo for build orchestration
and caching. This is the standard monorepo toolchain for TypeScript projects.

**Alternative considered**: Nx. Rejected — heavier setup, more opinionated.
Turborepo is simpler and sufficient for our needs.

## Risks / Trade-offs

**[BRouter Java dependency]** → The Planner requires a JVM to run BRouter.
This adds Docker image size (~200 MB) and memory usage (~128 MB heap).
Mitigation: BRouter runs in its own container with constrained resources.

**[Yjs document size growth]** → Long editing sessions could grow Yjs documents.
Mitigation: Monitor document sizes in PostgreSQL. Add compaction if needed.

**[Single server SPOF]** → All services on one Hetzner CX21.
Mitigation: Acceptable for 100 users. Daily backups to Hetzner Storage Box.
Scale to multiple servers in Phase 2 if needed.

**[BRouter segment freshness]** → RD5 segments are updated weekly on brouter.de.
Stale data could cause routing on newly built roads to fail.
Mitigation: Weekly cron job to download updated segments.

**[Cross-origin Planner-Journal integration]** → Planner and Journal are on
different subdomains (planner.trails.cool vs trails.cool). Cookie sharing
won't work.
Mitigation: JWT-based callback (Decision D6). No cookies needed.
