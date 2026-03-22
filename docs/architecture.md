# trails.cool - Architecture Plan

## Vision

A federated, self-hostable platform for collaborative route planning and social
activity sharing for outdoor enthusiasts. Two independent but integrated products:

1. **Planner** - Stateless collaborative route editor (like Etherpad for routes)
2. **Journal** - Federated social platform for routes and activities (like Mastodon for trails)

## Project Philosophy

These principles inform key architectural and product decisions:

- **Privacy by design**: The Planner collects no personal data and is minimal
  in storage. This is out of respect for BRouter and bikerouter.de which
  inspire this project. The Journal is equally mindful — all data collection
  is documented in a user-visible, always-up-to-date privacy manifest.
- **Data ownership**: Users own their data. The Journal provides easy export
  of all tracks and activities, migration to self-hosted instances, and clear
  documentation of the data format for each entity so users can build custom
  visualizations and tools around their data.
- **Open source (MIT)**: The code is MIT licensed — both because of the
  commitment to the open web, and out of respect for the open-source projects
  that inspire trails.cool (BRouter, bikerouter.de, brouter-web).
- **AI-assisted development**: AI (Claude Code) and spec-driven development
  (OpenSpec) are core to how this project is built. Human contributions are
  very welcome. This is also an experiment in how far AI-assisted development
  can bring such a project.
- **Internationalization from day one**: Use react-i18next for all user-facing
  strings. Start with English + German, community can contribute more.

### Instance Administration

The Journal supports instance administration:
- Open/close user registration
- User management (suspend/ban users)
- Federation management (block instances)
- Instance-level settings (name, description, rules)
- Moderation tools for reported content

Domain: trails.cool

## Product Separation

### Planner (planner.trails.cool)

- **Stateless**: No user accounts, no persistent user data storage
- **Privacy-first**: Planner never collects or stores user data — reflects the
  privacy philosophy of the BRouter ecosystem. No tracking, no analytics on
  user routes. Sessions are anonymous by default.
- **Collaborative**: Real-time editing via Yjs CRDTs
- **Session-based**: Shareable links, guests can join without accounts
- **BRouter-powered**: Server-side routing with OSM data
- **Ephemeral**: Sessions expire after configurable period (default 7 days)
- **Invocable**: Journal passes GPX + callback URL to start a session

Data model (Yjs CRDT document):
```typescript
{
  waypoints: Y.Array<{lat, lon, name, isDayBreak?: boolean}>,
  profile: Y.Map<string, any>,
  noGoAreas: Y.Array<Polygon>,
  notes: Y.Text,
  settings: Y.Map<string, any>
}
// Day breaks: waypoints marked with isDayBreak=true split the route into
// days/stages. Reordering waypoints doesn't break day assignments —
// days are derived from the sequence of day-break markers.
// The entire route is planned as one continuous route. Day breaks are
// just visual/logical split points for multi-day display.
```

Tech stack:
- Frontend: TypeScript + React + Tailwind + React Router 7 + Leaflet + OSM
- CRDT sync: Yjs + y-websocket
- Routing: BRouter (Java) wrapped as HTTP API
- Map data: RD5 segments (~750 MB for Germany, ~3 GB for Europe)

### Journal (trails.cool / self-hostable)

- **Stateful**: User accounts, persistent storage, media
- **Federated**: ActivityPub via Fedify (fedify.dev)
- **Self-hostable**: Docker Compose deployment
- **Mastodon-compatible**: Activities visible in Mastodon, likes/comments federate back

Features:
- Route CRUD (create, read, update, delete)
- Activity import (from Garmin, Strava, Wahoo via GPX/FIT upload)
- Activity export (to Garmin, Strava, Wahoo — later phase)
- Social: Following, likes, comments
- Photo sharing (as part of activities only, not standalone)
- Multi-day routes (bikepacking trips)
- Route versioning (sequential, with Yjs-based conflict resolution)
- GPX import/export
- Routes as blueprints: one route can have many linked activities

Tech stack:
- Frontend: TypeScript + React + Tailwind + React Router 7 + Leaflet + OSM
- Backend: React Router 7 (Remix stack) + Fedify for ActivityPub
- Database: PostgreSQL + PostGIS (spatial queries for route discovery)
- Media: S3-compatible (Garage for self-hosters — https://garagehq.deuxfleurs.fr/)
- Auth: Federated identity (@user@instance.com)

## Architecture Diagram

```
+-----------------------------------------------------+
| trails.cool (Flagship Instance)                      |
|                                                      |
|  +------------------+      +-------------------+     |
|  |  Planner         |      |  Journal     |     |
|  |  (Stateless)     |<---->|  (Stateful)       |     |
|  |                  |      |                    |     |
|  |  - Yjs sync      |      |  - PostgreSQL     |     |
|  |  - BRouter API   |      |  - S3 media       |     |
|  |  - Ephemeral     |      |  - ActivityPub    |     |
|  +------------------+      +-------------------+     |
|         ^                           ^                |
|         |                           |                |
|         +----------+----------------+                |
|                    | Auth/Identity                    |
|                    | (for initiated sessions)         |
+--------------------+---------------------------------+
                     |
                     | ActivityPub Federation
                     |
+--------------------v---------------------------------+
| bob.trails.xyz (Self-hosted)                         |
|                                                      |
|  +------------------+      +-------------------+     |
|  |  (No Planner)    |      |  Journal     |     |
|  |  Uses            |<---->|  (Same codebase)  |     |
|  |  trails.cool     |      |                    |     |
|  |  planner         |      |  - PostgreSQL +   |     |
|  +------------------+      |    PostGIS         |     |
|                            |  - Garage (S3)     |     |
|                            +-------------------+     |
+------------------------------------------------------+
```

## Data Flow: Collaborative Route Editing

### Scenario 1: Alice creates a new route

1. Alice opens Journal, clicks "New Route"
2. Journal creates route record, opens Planner with callback URL
3. Planner creates Yjs session, Alice edits waypoints
4. BRouter computes route from waypoints
5. Alice clicks "Save" -> Planner sends GPX to callback URL
6. Journal stores GPX as route v1

### Scenario 2: Alice invites Bob to collaborate

1. Alice shares Planner session link with Bob
2. Bob joins session (no account needed for planning)
3. Both edit waypoints in real-time via Yjs
4. One user acts as "routing host" (talks to BRouter API)
5. Route updates are broadcast to all session participants
6. When done, GPX is saved back to Alice's Journal instance

### Scenario 3: Bob (self-hosted) edits Alice's shared route

1. Bob's Journal receives Alice's shared route via ActivityPub
2. Bob clicks "Edit" -> Bob's instance opens trails.cool Planner
3. Planner loads latest GPX from Alice's instance
4. Bob edits, saves -> New version stored on Alice's instance
5. Update federates via ActivityPub

### Scenario 4: Cross-instance collaboration

1. Alice (trails.cool) starts planning session from her route
2. Federation notifies Bob (bob.trails.xyz) that a shared session is open
3. Bob joins Planner session via link
4. Both edit in real-time
5. Save stores GPX back to Alice's instance (route owner)
6. Bob's instance caches updated route via ActivityPub

## ActivityPub Integration

### Federated Activities

- `Create` Route - Publishing a new route
- `Update` Route - Updating an existing route
- `Create` Activity - Completed ride/hike with GPS trace
- `Like` Activity - Liking someone's activity
- `Create` Note (on Activity) - Commenting
- `Follow` / `Accept` - Following other users

### Mastodon Compatibility

Completed activities appear as posts with:
- Text description
- Map preview image (auto-generated)
- Link to full view on trails.cool (or the self hosted instance)
- Photo attachments
- GPX as attachment

Mastodon users can:
- See activities in their timeline
- Like activities (federates back)
- Comment on activities (federates back)

Route-specific federation (collaboration invites, version updates) uses
custom ActivityPub extensions not visible in Mastodon.

## Route Sharing & Permissions

### Visibility Levels

- **Private**: Only owner can see the route
- **Public**: Anyone can view the route (readonly)
- **Shared**: Specific invited users can view the route

### Permission Matrix

| Action | Owner | Shared (view) | Shared (edit) | Public | Guest (via link) |
|--------|-------|---------------|---------------|--------|-----------------|
| View route | yes | yes | yes | yes | no |
| Export GPX | yes | yes | yes | yes | no |
| Start edit session | yes | no | yes | no | no |
| Join edit session | yes | no | yes | no | yes* |
| Delete route | yes | no | no | no | no |
| Change permissions | yes | no | no | no | no |
| Fork route (copy) | yes | yes | yes | yes | no |

Notes:
- "Shared (edit)" users are explicitly granted edit rights by the owner
- There is no "public editable" — edit access requires explicit invitation
- *Owners can always share a direct link to an active edit session that
  anyone (including guests) can join — this bypasses the permission matrix
  for joining that specific session only
- Guests (no account) can join Planner sessions via link, but cannot
  save routes to a Journal instance
- Forking creates an independent copy on the user's own instance

## Activity Sharing & Participants

When multiple people do the same activity together (e.g., a group ride),
they can tag each other as participants:

- Activity creator can **tag other users** as participants
- Tagged users receive a notification and can confirm/decline
- Confirmed participants see the activity linked in their own profile
- Each participant can attach their own GPS trace and photos to the
  shared activity (their recording may differ slightly)
- ActivityPub: Participant tagging federates across instances
  (Alice on trails.cool tags Bob on bob.trails.xyz)
- Mastodon: Appears as mentions (`"Rode with @bob@bob.trails.xyz"`)

This is similar to how photos work on social media — you can be tagged
in someone else's activity, and it shows on your profile too.

## Multi-Day Route Support

### Route Planning (Planner)

Routes are planned as **one continuous route**. Day splits are marked by
flagging specific waypoints as day-break points:

- The entire route is planned end-to-end in a single Planner session
- Specific waypoints are marked as `isDayBreak: true` (e.g., overnight stops)
- Days are derived from the sequence of day-break markers
- Reordering waypoints automatically recalculates day assignments
- Each day/stage gets its own distance and elevation stats
- GPX export uses track segments per day

### Activities (Journal)

Multi-day trips are modeled as an **Activity Collection**:

- A multi-day activity is a collection linking individual day-activities
- Each day-activity has its own GPS trace, photos, and description
- The collection references the planned route as a whole
- This allows tracking a 5-day bikepacking trip as one entity while
  recording each day separately (possibly from different devices/apps)
- Individual day-activities can be imported from Garmin/Strava per day

Note: Exact data model for collections TBD — needs more design work.

## Import/Export

### Import Sources
- GPX files (manual upload)
- FIT files (Garmin devices)
- External tools (bikerouter.de, Komoot, etc.)
- Activity platforms (Strava, Garmin Connect, Wahoo) - OAuth or file upload

### Export Formats
- GPX (primary)
- GeoJSON
- KML

## Self-Hosting

### Minimal Docker Compose (Journal only)

```yaml
services:
  journal:
    image: ghcr.io/trails-cool/journal:latest
    ports: ["3000:3000"]
    environment:
      DOMAIN: bob.trails.xyz
      PLANNER_URL: https://planner.trails.cool
      DATABASE_URL: postgres://trails:trails@postgres/trails
      S3_ENDPOINT: http://garage:3900
      S3_BUCKET: trails-media
    depends_on: [postgres, garage]

  postgres:
    image: postgis/postgis:16-3.4
    volumes: ["pgdata:/var/lib/postgresql/data"]

  garage:
    image: dxflrs/garage:v1.0
    volumes: ["media:/var/lib/garage"]

  caddy:
    image: caddy:2
    ports: ["80:80", "443:443"]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
    depends_on: [journal]

volumes:
  pgdata:
  media:
  caddy_data:
```

Caddy is the reverse proxy for all instances. It provides automatic HTTPS
via Let's Encrypt with zero configuration beyond the Caddyfile:

```
# Caddyfile (self-hosted example)
bob.trails.xyz {
    reverse_proxy journal:3000
}
```

### With Self-Hosted Planner (Advanced)

```yaml
services:
  # ... above services plus:

  planner:
    image: ghcr.io/trails-cool/planner:latest
    ports: ["3001:3001"]
    environment:
      BROUTER_URL: http://brouter:17777
    depends_on: [brouter]

  brouter:
    image: ghcr.io/trails-cool/brouter:latest
    volumes:
      - segments:/data/segments
    # Segments can be pulled from:
    # - https://brouter.de/brouter/segments4/ (official, weekly updates)
    # - A trails.cool CDN mirror (later)
    ports: ["17777:17777"]

volumes:
  segments: # Download RD5 files here (~750 MB Germany, ~3 GB Europe)
```

## Infrastructure (trails.cool flagship)

### Hosting: Hetzner Cloud

- Server: CX21 (2 vCPU, 4 GB RAM, 40 GB SSD) - ~5 EUR/month
- Storage Box: 1 TB for RD5 segments + media - ~3.20 EUR/month
- Infrastructure as Code: Terraform (Hetzner provider) + Docker Compose
- CI/CD: GitHub Actions
- Monitoring: Grafana + Prometheus + Loki (flagship only)
- Error tracking: Sentry

### Services

```
planner.trails.cool    -> Planner frontend + Yjs sync + BRouter
trails.cool            -> Journal frontend + API
api.trails.cool        -> ActivityPub endpoints
cdn.trails.cool        -> Media + map tiles (optional)
```

### Estimated Costs (100 users)

- Hetzner CX21: 5 EUR/month
- Storage: 3.20 EUR/month
- Domain: ~10 EUR/year
- Backups: ~2 EUR/month
- Total: ~12 EUR/month

## GitHub Repository Structure

GitHub organization: **github.com/trails-cool**

### Monorepo vs Multi-Repo

**Recommendation: Monorepo** (single repo for planner + Journal)

Pros:
- **Shared components**: React component library, TypeScript types, and utilities
  shared between Planner and Journal without publishing npm packages
- **Atomic changes**: A change to the Route interface updates both apps in one PR
- **Simpler CI/CD**: One pipeline builds and deploys both apps
- **Claude Code / OpenSpec**: Specs and AI-assisted development work best when
  the full context is in one repo
- **Tooling**: Turborepo/Nx handles monorepo builds, caching, and dependency graph

Cons:
- Larger repo size (mitigated by sparse checkouts)
- Self-hosters who only want Journal need to build from monorepo
  (mitigated by publishing Docker images)

### Proposed Structure

```
github.com/trails-cool/trails
  apps/
    planner/            - Planner app (React Router 7)
    journal/            - Journal app (React Router 7 + Fedify)
  packages/
    ui/                 - Shared React components (map, buttons, layout)
    types/              - Shared TypeScript types (Route, Activity, etc.)
    map/                - Map rendering utilities (Leaflet wrappers, tile layers)
    gpx/                - GPX parsing, generation, validation
    i18n/               - Shared i18n config + translation strings (react-i18next)
  infrastructure/       - Terraform + Docker Compose
  specs/                - OpenSpec specifications
  docker/
    brouter/            - BRouter Docker image + segment management
  docs/                 - Documentation
```

Tooling: **Turborepo** for monorepo management, **pnpm** workspaces.

OpenSpec specs live in `specs/` directory, feeding into both apps.
This keeps specifications close to implementation and allows Claude Code
to reference specs when working on either app.

## MVP Phasing

Note: Detailed specifications for each phase will be created using
[OpenSpec](https://openspec.dev/) and stored in the `specs/` directory
of the monorepo. This architecture plan feeds into OpenSpec as the
high-level context for generating implementation specs.

### Phase 1: Foundation (Weeks 1-8)

**Planner MVP**:
- [ ] Collaborative waypoint editing (Yjs)
- [ ] BRouter integration (route computation)
- [ ] Map display (Leaflet + OSM overlays)
- [ ] Session sharing (shareable link)
- [ ] Profile selection (bike/hike)
- [ ] Elevation profile display
- [ ] GPX export

**Journal MVP**:
- [ ] User accounts (local, no federation)
- [ ] Route CRUD
- [ ] Start Planner session from route (callback integration)
- [ ] GPX import/export
- [ ] Basic profile page
- [ ] Activity feed (own activities)

### Phase 2: Social & Federation (Months 3-6)

- [ ] ActivityPub federation
- [ ] Following/followers
- [ ] Likes and comments
- [ ] Activity import (Strava/Garmin GPX/FIT upload)
- [ ] Photo attachments on activities
- [ ] Mastodon compatibility
- [ ] Route sharing permissions
- [ ] Route versioning

### Phase 3: Scale & Mobile (Months 6-12)

- [ ] Mobile app (Capacitor or native)
- [ ] Offline route editing (WASM + cached segments)
- [ ] Multi-day route planning
- [ ] Route recommendations
- [ ] Clubs/groups
- [ ] CDN for map segments (mobile offline)

## Resolved Decisions

### 1. Route Versioning: Sequential + Yjs Conflict Resolution

Sequential version numbers (v1, v2, v3). When two users edit the same route
concurrently via separate Planner sessions, conflicts are resolved using Yjs
CRDT merge semantics:

- The Planner session stores the full Yjs document state (waypoints, settings)
- When saving back to the Journal, the GPX + Yjs state vector are stored
- If a second session started from an older version, the Yjs state vectors
  can be merged automatically (CRDTs are conflict-free by design)
- The merged result becomes the next sequential version
- Edge case: If edits are made via raw GPX upload (not through Planner),
  no Yjs state exists — last-write-wins with the previous version archived

### 2. Route Mirroring: Accept-Based Collaboration Mirroring

Collaborator instances mirror routes they've been invited to:

1. Alice shares route with Bob → ActivityPub `Invite` activity
2. Bob's instance receives invite → shows in Bob's UI
3. Bob accepts → ActivityPub `Accept` activity
4. Alice's instance adds Bob as collaborator → sends current GPX + metadata
5. Bob's instance stores a mirror copy (read cache)
6. On route `Update`, Alice's instance sends updated GPX to all collaborators
7. If Alice's instance is down, Bob still has his cached copy

Canonical source is always the owner's instance. Mirrors are read caches
that stay in sync via ActivityPub `Update` activities.

### 3. Cross-Instance Edits: Edit on Planner, Store to Owner via Callback

When Bob edits Alice's route:

1. Bob's Journal opens Planner with Alice's GPX
2. Planner session callback points to Alice's instance API
3. On save, Planner POSTs new GPX to Alice's instance (with auth token)
4. Alice's instance creates new version, credits Bob as contributor
5. Update federates to all collaborators (including Bob's mirror)

This keeps the owner's instance as single source of truth. Bob never stores
a "draft" on his own instance — edits go directly to the canonical source.

### 4. Planner Session Lifetime

- Sessions are created on demand (from Journal or direct link)
- Session lifetime is **configurable** (default: 7 days, max: 30 days)
- Session state is saved server-side (Yjs document in PostgreSQL)
- Manual save triggers callback to Journal (stores GPX as new version)
- Session owner can **manually close** the session (notifies all participants)
- Abandoned sessions are garbage-collected after expiry
- Browser localStorage keeps a backup of unsaved Yjs state for crash recovery
- Resource usage to be observed and session defaults tuned accordingly

### 5. Frontend Framework: React + Tailwind + React Router 7

- **React** with **Tailwind CSS** for styling
- **React Router 7** (Remix stack) for both Planner and Journal
- Shared component library between Planner and Journal
- Leaflet for map rendering with OSM tiles

### 6. Journal Backend: React Router 7 + Fedify

- **React Router 7** (Remix stack) — full-stack TypeScript framework
  - Server-side rendering for SEO and initial load
  - API routes for ActivityPub endpoints
  - Loader/action pattern for data fetching
- **Fedify** (fedify.dev) for ActivityPub protocol support
  - Handles WebFinger, HTTP Signatures, inbox/outbox
  - TypeScript-native, integrates well with the stack
  - Avoids reimplementing ActivityPub from scratch

### 7. Database: PostgreSQL (with PostGIS)

PostgreSQL for all deployments (flagship and self-hosted). PostGIS is valuable
for trails.cool because:

- **Spatial queries**: "Find routes near me" or "routes in this bounding box"
- **Route geometry storage**: Store route linestrings as PostGIS geometries
- **Distance calculations**: "Routes within 50km of Berlin"
- **Spatial indexing**: Fast lookups for map-based route browsing
- **Overlap detection**: "Routes similar to this one"

For self-hosters, PostGIS is included in the standard `postgis/postgis` Docker
image — no extra setup needed.

Note: SQLite option dropped for simplicity. PostGIS is too valuable, and
PostgreSQL via Docker is easy enough for self-hosters.

### 8. Route Format: GPX + Metadata Envelope

GPX alone is insufficient. Routes are stored as a **metadata envelope** wrapping
the GPX:

```typescript
interface Route {
  id: string;
  name: string;
  description: string;
  gpx: string;                    // Canonical GPX (track + waypoints)
  geometry: PostGIS.LineString;    // Extracted for spatial queries
  metadata: {
    created: Date;
    updated: Date;
    owner: string;                // ActivityPub actor URI
    contributors: string[];       // ActivityPub actor URIs
    routingProfile: string;       // 'trekking', 'mtb', 'car', etc.
    dayBreaks: number[];           // Waypoint indices that are day-break points
    distance: number;             // meters (computed from GPX)
    elevation: {
      gain: number;               // meters
      loss: number;               // meters
    };
    tags: string[];               // user-defined tags
  };
  plannerState?: Uint8Array;      // Yjs document state for conflict resolution
  versions: RouteVersion[];
}

interface RouteVersion {
  version: number;
  gpx: string;
  createdAt: Date;
  createdBy: string;              // ActivityPub actor URI
  changeDescription?: string;
}
```

**Why GPX is not enough**:
- No routing preferences (bike vs car, avoid highways)
- No contributor metadata
- No version history
- No multi-day structure (GPX tracks can have segments, but no day labels)
- No spatial indexing (need PostGIS geometry extracted from GPX)

**GPX remains the interchange format**: Import/export always uses GPX.
The metadata envelope is internal storage only.

When federating via ActivityPub, routes are sent as:
- GPX attachment (for interoperability)
- JSON-LD metadata (for rich display in trails.cool instances)

### 9. Route-to-Activity Relationship: One Route, Many Activities

A Route is a **blueprint**. An Activity is a **completed instance**.

```
Route: "Sunday Black Forest Loop" (60km, 800m elevation)
  ├── Activity: Alice rode it on March 15 (with GPS trace, photos)
  ├── Activity: Alice rode it on March 22 (different weather, faster time)
  └── Activity: Bob rode it on March 20 (imported from Strava)
```

Database model:
```
routes     1 ──── N  activities
  id                   id
  name                 route_id (nullable — activities can exist without a route)
  gpx                  actual_gpx (recorded GPS trace, differs from planned route)
  ...                  started_at
                       duration
                       photos[]
                       description
```

Activities can also exist **without** a route (e.g., imported from Strava with
no pre-planned route). Users can retroactively link an activity to a route,
or create a new route from an activity's GPS trace.

### 10. Routing Host: Session Initiator + Automatic Failover

The "routing host" is the client responsible for sending waypoint changes to
BRouter and broadcasting the computed route to other participants.

- **Initial host**: The user who created/started the Planner session
- **Failover**: If host disconnects, the Yjs awareness protocol detects it
  and the longest-connected remaining client becomes the new host
- **Implementation**: Yjs awareness state includes a `role` field
  ```typescript
  awareness.setLocalStateField('role', 'host' | 'participant');
  // On host disconnect, participants compare join timestamps
  // Lowest timestamp becomes new host
  ```
- **Why not everyone**: Sending every waypoint change from every client to
  BRouter would cause redundant API calls and race conditions
- **Route broadcast**: Host computes route, stores result in a Y.Map field
  that syncs to all participants automatically

### 11. Yjs Persistence: PostgreSQL

Store Yjs documents in PostgreSQL (not LevelDB). This keeps the Planner's
session state in the same database infrastructure, simplifies backups, and
allows querying session metadata (last activity, participant count) for
garbage collection.

The Planner service uses its own PostgreSQL schema (`planner.*`) separate
from the Journal schema (`activity.*`). On the trails.cool flagship,
both schemas live in the same PostgreSQL instance. Self-hosters who don't
run a Planner don't need the planner schema.

### 12. Cross-Instance Auth: Scoped JWT Tokens

When Alice's Journal opens a Planner session for a route:

1. Alice's instance generates a **scoped JWT token** containing:
   - `iss`: Alice's instance URL (`https://trails.cool`)
   - `route_id`: The route being edited
   - `permissions`: `["read", "write"]`
   - `exp`: Token expiry (matches session lifetime)
2. This token is passed to the Planner as part of the callback URL
3. When the Planner saves, it includes the JWT in the callback POST
4. Alice's instance validates the JWT signature and stores the new version

For cross-instance edits (Bob editing Alice's route):
- Bob's instance requests a scoped token from Alice's instance
- Alice's instance verifies Bob has edit rights, issues a token
- This uses **HTTP Signatures** (already part of ActivityPub) for
  instance-to-instance trust, plus JWT for the Planner callback

### 13. Rate Limiting

For the public trails.cool Planner instance:

- **Session creation**: Max 10 sessions per IP per hour
- **BRouter API calls**: Max 60 route computations per session per hour
  (debouncing on the client should keep this well under limit)
- **Concurrent sessions**: Max 50 active sessions per IP
- **Abuse detection**: Flag sessions with unusual patterns
  (automated bulk routing, scraping)
- **Implementation**: Rate limiting middleware in React Router 7,
  backed by Redis or in-memory store (for single-server setup)

Self-hosted Planner instances can configure their own limits.

### 14. Map Tiles & Overlays

Base layers:
- **OpenStreetMap** (default)
- **OpenTopoMap** (topographic — great for hiking)
- **CyclOSM** (cycling-focused — great for bike routes)

Overlays (toggleable):
- **OpenCampingMap** (campsites, shelters — essential for bikepacking)
- **POI overlay**: Water points, shelters, bike repair stations
  (sourced from OSM Overpass API or pre-cached)
- **Waymarked Trails** (hiking/cycling trail networks)

Implementation: Leaflet layer switcher with tile URLs. No API keys needed
for OSM-based tiles (but respect usage policies and consider setting up
a tile cache/proxy for the flagship instance).

### 15. Monitoring & Observability

For trails.cool flagship instance only (not required for self-hosters):

- **Metrics**: Prometheus (scrape Node.js and PostgreSQL exporters)
- **Dashboards**: Grafana (route computation latency, active sessions,
  federation delivery, PostgreSQL performance)
- **Logging**: Loki (structured JSON logs from all services)
- **Alerting**: Grafana Alertmanager (disk space, memory, error rate)
- **Error tracking**: Sentry (frontend + backend exceptions)

Stack: Grafana + Prometheus + Loki (the "GPL stack"), self-hosted on
the same Hetzner server or a separate small instance.

PostgreSQL monitoring is especially important:
- Query performance (slow queries, index usage)
- PostGIS spatial query latency
- Connection pool utilization
- Replication lag (if we scale later)

### 16. Federation Delivery & Retry

When Alice sends an update and Bob's instance is down:

- ActivityPub uses **HTTP POST** to deliver activities to inboxes
- If delivery fails (timeout, 5xx), Fedify implements **automatic retry**
  with exponential backoff:
  - Retry after 1 min, 5 min, 30 min, 2 hours, 12 hours, 24 hours
  - Give up after 72 hours of failures
- This is standard ActivityPub behavior (same as Mastodon)
- Bob's instance receives the update when it comes back online
- If the update is lost (instance down > 72 hours), Bob's mirror becomes
  stale — a periodic "sync check" can detect and heal this

### 17. Planner Session Management (Updated)

- Session lifetime: **Configurable** (default: 7 days, max: 30 days)
  - Start conservative — observe resource usage and tune
  - Yjs document size in PostgreSQL is small (~10-100 KB per session)
  - Main cost is WebSocket connections for active sessions
- **Manual close**: Session owner (initiator) can close the session
  - Closing notifies all connected participants
  - Triggers auto-save callback if Journal session
  - Closed sessions become read-only briefly, then deleted
- **Garbage collection**: Cron job removes expired sessions

### 18. Domain: Single Domain per Instance

Each instance uses a single domain. No split between web app URL and
ActivityPub handle domain. Self-hosters set `DOMAIN=bob.trails.xyz` and
both the web UI and user handles (`@user@bob.trails.xyz`) use that domain.

Simpler to set up, simpler to reason about, avoids WebFinger complexity.

### 19. Route Permissions: View + Edit (Simple)

Two permission levels are sufficient:
- **View**: Can see the route and export GPX
- **Edit**: Can start/join edit sessions and create new versions

No finer-grained permissions (e.g., "edit waypoints but not profile").
Keep it simple. Can revisit if users request it.

## Remaining Open Questions

1. **Multi-day activity collections**: Exact data model for linking day-activities
   into a multi-day trip collection
2. **brouter-web dependencies**: Review https://github.com/nrenner/brouter-web
   for proven library choices (map rendering, elevation charts, etc.)
