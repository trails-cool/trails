## Context

trails.cool is a two-app web platform: Planner (stateless, collaborative, Yjs) and Journal (accounts, PostgreSQL, ActivityPub). The Planner uses Leaflet for maps, Yjs for real-time sync, and BRouter for routing. The Journal stores routes, activities, and user data. Shared packages (`types`, `gpx`, `i18n`) are pure TypeScript.

The mobile app combines both apps into a single React Native + Expo experience, communicating with the Journal as its backend. The user is an experienced React Native/Expo developer.

## Goals / Non-Goals

**Goals:**
- Unified mobile app (plan + journal in one)
- Authenticate with existing Journal account
- View and edit routes on the go
- Record GPS activities
- Work offline for viewing routes
- Reuse shared TypeScript packages

**Non-Goals:**
- Full collaborative Yjs editing on mobile (too complex for v1 — use direct API)
- Self-hosting the mobile app (App Store distribution only)
- Replacing the web Planner (mobile editing is simplified)
- ActivityPub federation from mobile (handled by Journal server)
- Offline route computation (BRouter requires server)

## Decisions

### D1: Expo managed workflow with monorepo integration

Place the app at `apps/mobile/` in the existing pnpm monorepo. Use Expo managed workflow (no native code ejection) with EAS Build for CI/CD. Share packages via pnpm workspace — `@trails-cool/types`, `@trails-cool/gpx`, `@trails-cool/i18n` imported directly.

The `gpx` package uses `linkedom` for Node.js XML parsing. On mobile, use the built-in `DOMParser` (available in React Native's JSC/Hermes via a polyfill or the existing browser code path in `parseGpx`).

### D2: Authentication via OAuth2 PKCE

The Journal currently uses passkeys + magic links. Neither works well in a native app context. Add an OAuth2 authorization code flow with PKCE to the Journal:

- Mobile app opens Journal's `/oauth/authorize` in an in-app browser
- User authenticates via existing passkey/magic link
- Journal redirects back with auth code
- Mobile app exchanges code for access + refresh tokens
- Tokens stored in Expo SecureStore

This keeps the auth UI on the web (no need to implement passkey in native code) while giving the mobile app long-lived tokens.

The mobile app sends a device name (e.g., model + OS version) during token exchange. The Journal stores this alongside the token, enabling a "Connected Devices" list on the Journal web settings page where users can see active sessions and revoke individual devices. This is primarily relevant for the hosted version — self-hosted instances with a single user would rarely use it, but the data is stored regardless.

### D2b: Configurable server URL

The mobile app defaults to `https://trails.cool` but allows connecting to any self-hosted Journal instance. On the login screen, a "Connect to a different server" option lets the user enter a custom URL (e.g., `https://trails.example.org`). The app validates the URL by fetching `/.well-known/trails-cool` (or a similar discovery endpoint) to confirm it's a compatible instance.

The server URL is stored persistently and used as the base for all API calls and the OAuth2 login flow. Users can switch instances from the Profile tab — this logs them out and clears local data.

The `/.well-known/trails-cool` discovery endpoint returns an `apiVersion` semver string (e.g., `"1.0.0"`). The mobile app declares a `requiredApiVersion` (minimum semver it needs). On connect and on app foreground, the app checks:

- Server `apiVersion` satisfies app's required range → normal operation.
- Server `apiVersion` too low → **Block**: "This server needs to be updated. Please ask the administrator to upgrade." The app still allows read-only access to cached offline data.

The API follows semver: patch versions for fixes, minor versions for additive changes (new endpoints, new optional fields), major versions only for breaking changes. Since the API is backwards compatible by design, a newer server always works with an older app — no "server too new" check needed.

### D2c: Shared API contract package

A new `packages/api/` workspace package (`@trails-cool/api`) serves as the single source of truth for the REST API:

- `API_VERSION` constant (semver string)
- TypeScript types for all request/response shapes (e.g., `RouteListResponse`, `CreateActivityRequest`)
- Endpoint path constants (e.g., `ENDPOINTS.routes.list = "/api/v1/routes"`)
- Error response type

The package uses Zod schemas as the source of truth — TypeScript types are inferred via `z.infer<>`. The Journal server uses schemas to validate incoming request bodies. The mobile client can optionally validate responses (useful for self-hosted instances on older versions). Both sides share the same schemas — runtime validation and type safety from one definition.

### D3: MapLibre GL for mobile maps

Leaflet is web-only. Use `react-native-maplibre-gl` for mobile — OSM vector tiles, GPU-accelerated, free, consistent with the web's OSM data source. Requires an Expo config plugin but is well-supported.

The web Planner stays on Leaflet for now, but map logic should be structured for future convergence:

- **`@trails-cool/map-core`** (new package): Renderer-agnostic definitions — tile source URLs, overlay configs, color palettes (route coloring, POI categories), z-index layering order. Pure data, no rendering code.
- **`@trails-cool/map`** (existing): Leaflet-specific components for web, imports from `map-core`
- **`apps/mobile/`**: MapLibre-specific components for mobile, imports from `map-core`

This way, switching the web to MapLibre later means replacing `@trails-cool/map` internals while `map-core` stays unchanged. The mobile app validates that `map-core` abstractions work before the web migration.

### D4: Simplified route editing (no Yjs)

Mobile route editing talks directly to the Journal API:
1. Fetch route GPX → parse waypoints
2. User adds/moves/deletes waypoints on the map
3. Compute route via BRouter (through a proxy endpoint on the Journal, or direct to the Planner's BRouter instance)
4. Save updated GPX back to Journal API

No real-time collaboration on mobile. If the user needs full collaborative editing, deep-link to the Planner web app.

### D5: Offline with SQLite + tile cache

- Routes: Download GPX + parsed waypoints into Expo SQLite
- Map tiles: Use `react-native-maps`' built-in tile caching, or download tile packages for specific regions
- Activities: Stored locally first, synced to Journal when online
- Edit queue: Changes made offline queued and synced on reconnect (conflict resolution: last-write-wins, with a warning if the server version changed)

### D6: Activity recording

Activity recording (GPS tracking, HealthKit) is a separate change — see `mobile-activity-recording`.

### D7: Navigation structure

Tab bar with 4 tabs:
- **Map**: Current route on map, quick edit, start recording
- **Routes**: List of user's routes from Journal
- **Activities**: List of recorded activities
- **Profile**: Account settings, offline data management, sync status

### D8: BRouter routing via Journal API proxy

The mobile app computes routes through the Journal API: `POST /api/v1/routes/compute`. The Journal forwards the request to its BRouter instance and returns the enriched route. This avoids exposing BRouter publicly and works with self-hosted instances where the BRouter container isn't publicly accessible.

### D9: Photo uploads via presigned URLs

Route and activity photos are stored in S3/Garage (existing infrastructure). The API returns presigned upload URLs — the mobile app uploads directly to storage, then confirms the upload via the API. This avoids proxying large files through the Journal server.

### D10: Cursor-based pagination

All list endpoints (routes, activities) use cursor-based pagination. The response includes a `nextCursor` field — the client passes it back to get the next page. This handles feeds that change (new items, deletions) without skipping or duplicating entries.

### D11: Expo monorepo support

Use Expo's built-in `experiments.monorepo: true` in `app.config.ts` to resolve pnpm workspace packages in Metro. This handles symlink resolution and shared package discovery automatically.

### D12: Push notifications via Web Push relay

Following Mastodon's proven architecture for federated push notifications:

- **Journal instances implement standard Web Push API** (RFC 8030) — no Apple/Google dependencies on the server side
- **trails.cool hosts a relay service** that translates Web Push → APNs (iOS) and FCM (Android). Self-hosted instances send standard Web Push to this relay.
- **Notifications are end-to-end encrypted** — the relay forwards encrypted payloads without reading them
- **Self-hosted admins need zero configuration** — no Apple Developer account, no Firebase project. Standard Web Push just works.
- **The relay is open-source** — self-hosters who want full independence can run their own relay with their own APNs/FCM credentials

Flow: `Journal instance → Web Push (encrypted) → trails.cool relay → APNs/FCM → phone`

This aligns with the ActivityPub federation direction and matches how Mastodon clients (Toot!, Ice Cubes, etc.) handle push for thousands of self-hosted instances through a single relay.

### D13: State management

Three layers, each with a clear responsibility:

- **TanStack Query** for server state — routes, activities, user profile. Provides caching, background refetch, stale-while-revalidate, cursor pagination helpers, and optimistic updates. All Journal API data flows through TanStack Query hooks.
- **Zustand** for local UI state — edit mode flags, recording state, offline queue status, selected map layer, download progress. Small, synchronous stores with no persistence (or optional persistence to AsyncStorage where needed).
- **React Context** only for auth token and server URL — these are set once at login and consumed everywhere. No complex state, no frequent updates. Avoids prop drilling for the two values every API call needs.

### D14: Tile hosting

MapLibre needs a vector tile source. Default to **OpenFreeMap** — free, OSM-based, no API key required. This matches the project's principle of using open standards and avoiding vendor lock-in.

Self-hosted instances can configure a custom tile URL in the discovery endpoint. The `/.well-known/trails-cool` response gains a `tileUrl` field (e.g., `"tileUrl": "https://tiles.example.org/{z}/{x}/{y}.pbf"`). When present, the mobile app and any future MapLibre web client use it instead of the default.

Fallback: if vector tiles fail to load (offline, misconfigured URL), fall back to raster tiles from OpenStreetMap tile servers — the same approach the web Planner already uses with Leaflet.

### D15: Photo/media handling

Routes and activities can have photos. The upload flow avoids proxying large files through the Journal server:

1. Client requests a presigned upload URL from `POST /api/v1/uploads` with filename and content type
2. Client uploads the file directly to S3/Garage using the presigned URL
3. Client confirms the upload via the API with the storage key (e.g., `POST /api/v1/routes/:id` or `PUT /api/v1/routes/:id` with the storage key in the photos array)

Photos are stored as an array of URLs on the route or activity record. Thumbnails are generated server-side on upload confirmation — the Journal creates a resized version and stores it alongside the original. The API returns both `url` and `thumbnailUrl` for each photo.

### D16: Journal REST API implementation

The REST API endpoints (`/api/v1/*`) are implemented as React Router route modules under `apps/journal/app/routes/api.v1.*.ts`. This follows the existing routing pattern — both apps use explicit `routes.ts` for registration.

Shared middleware handles:
- **Bearer token validation**: Extracts and validates the OAuth2 access token from the `Authorization` header, attaches the authenticated user to the request context
- **Zod body parsing**: Validates request bodies against schemas from `@trails-cool/api`, returns structured 400 errors on failure
- **Error formatting**: Catches exceptions and returns the standard `ApiErrorResponse` shape

Existing web routes (cookie-based auth, form actions, loaders) remain unchanged. The `/api/v1/*` routes use bearer tokens exclusively — no cookie sessions.

## Risks / Trade-offs

- **BRouter access from mobile**: The BRouter instance runs in Docker alongside the Planner. The mobile app needs a route computation endpoint. Options: (a) proxy through Journal API, (b) expose BRouter publicly with auth, (c) use a public BRouter instance. Option (a) is safest.
- **Map tile licensing**: Google Maps requires an API key and has usage-based pricing. Apple Maps is free on iOS. Consider MapLibre with OpenStreetMap tiles for a free, consistent cross-platform solution.
- **React Native Maps vs MapLibre**: `react-native-maps` is more mature but ties to Google/Apple. `react-native-maplibre-gl` uses vector tiles and is more consistent with the web's OSM-based approach. Worth evaluating.
- **Offline storage size**: Map tiles for a region can be hundreds of MB. Need a download manager with progress and storage budget.
- **App Store review**: GPS background tracking + health data access need careful privacy descriptions.
