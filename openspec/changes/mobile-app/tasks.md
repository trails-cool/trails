## Phase 1: Foundation

### 1.1 App Scaffold

- [ ] 1.1.1 Initialize Expo managed project at `apps/mobile/` with TypeScript template
- [ ] 1.1.2 Configure pnpm workspace to include `apps/mobile` and resolve shared packages (`@trails-cool/types`, `@trails-cool/gpx`, `@trails-cool/i18n`)
- [ ] 1.1.3 Set up Expo Router with bottom tab navigation (Map, Routes, Activities, Profile) and placeholder screens
- [ ] 1.1.4 Add app icon, splash screen, and `app.config.ts` with bundle identifiers for iOS and Android
- [ ] 1.1.5 Configure EAS Build for development and preview profiles

### 1.2 API Contract Package

- [x] 1.2.1 Create `packages/api/` with `API_VERSION` constant, endpoint path constants, and TypeScript types for all request/response shapes
- [x] 1.2.2 Define route types: `RouteListResponse`, `RouteDetailResponse`, `CreateRouteRequest`, `UpdateRouteRequest`
- [x] 1.2.3 Define activity types: `ActivityListResponse`, `ActivityDetailResponse`, `CreateActivityRequest`
- [x] 1.2.4 Define auth types: `TokenExchangeRequest`, `TokenResponse`, `DiscoveryResponse`
- [x] 1.2.5 Define shared error type: `ApiErrorResponse` with code, message, and optional field errors
- [x] 1.2.6 Export everything from package index, add to pnpm workspace and Turborepo pipeline

### 1.3 Shared Package Compatibility

- [ ] 1.3.1 Audit `@trails-cool/types` for DOM/Node.js dependencies — confirm it's pure TypeScript interfaces
- [ ] 1.3.2 Refactor `@trails-cool/gpx` to use a platform-agnostic XML parser: use `linkedom` on Node.js and `DOMParser` on React Native/browser
- [ ] 1.3.3 Write unit tests for `parseGpx()` and `generateGpx()` running in a jsdom-free environment to verify no DOM dependency
- [ ] 1.3.4 Verify `@trails-cool/i18n` initializes in React Native — add an `initMobile()` export if the current init assumes a browser environment
- [ ] 1.3.5 Add `apps/mobile` to Turborepo pipeline (`turbo.json`) for build and typecheck

### 1.4 Journal Auth (OAuth2 PKCE)

- [ ] 1.4.1 Add `journal.oauth_clients` table with client_id, redirect_uri, and trusted flag
- [ ] 1.4.2 Add `journal.oauth_codes` table (code, userId, clientId, codeChallenge, codeChallengeMethod, expiresAt)
- [ ] 1.4.3 Add `journal.oauth_tokens` table (accessToken, refreshToken, userId, clientId, expiresAt)
- [ ] 1.4.4 Implement `GET /oauth/authorize` endpoint — show login UI, generate auth code on success, redirect to client
- [ ] 1.4.5 Implement `POST /oauth/token` endpoint — validate PKCE code_verifier, issue access + refresh tokens
- [ ] 1.4.6 Implement refresh token grant in `POST /oauth/token`
- [ ] 1.4.7 Add middleware to validate OAuth2 bearer tokens on existing API routes
- [ ] 1.4.8 Seed `trails-cool-mobile` as a trusted first-party OAuth2 client with `trailscool://` redirect URI
- [ ] 1.4.9 Write unit tests for PKCE challenge validation, token issuance, and token refresh

### 1.5 Server Configuration

- [ ] 1.5.1 Add server URL input on login screen with "Connect to a different server" toggle (defaults to `https://trails.cool`)
- [ ] 1.5.2 Add `GET /.well-known/trails-cool` discovery endpoint on the Journal — returns instance name, version, API base URL
- [ ] 1.5.3 Validate entered server URL by fetching discovery endpoint before proceeding to login
- [ ] 1.5.4 Check `apiVersion` semver from discovery against app's required minimum — block with upgrade prompt if server is too old
- [ ] 1.5.5 Persist server URL in Expo SecureStore, use as base for all API calls and OAuth2 flow
- [ ] 1.5.6 Re-check API version on app foreground (after background) — show banner if version mismatch detected
- [ ] 1.5.7 Add "Switch server" option on Profile tab — logs out, clears local data, returns to login

### 1.6 Journal API Client (Mobile)

- [ ] 1.6.1 Create `apps/mobile/src/lib/api-client.ts` with base HTTP client, auth header injection, and 401 auto-refresh logic
- [ ] 1.6.2 Create `apps/mobile/src/lib/auth.ts` with OAuth2 PKCE login flow using `expo-auth-session` and token storage via `expo-secure-store`
- [ ] 1.6.3 Implement routes API methods: listRoutes, getRoute, updateRoute, createRoute
- [ ] 1.6.4 Implement activities API methods: listActivities, getActivity, createActivity
- [ ] 1.6.5 Add typed error handling for network failures, 401, and server errors
- [ ] 1.6.6 Write unit tests for API client with mocked fetch responses

## Phase 2: Journal REST API

### 2.1 Auth & Discovery Endpoints

- [ ] 2.1.1 Implement bearer token auth middleware for `/api/v1/*` routes
- [ ] 2.1.2 Implement `GET /.well-known/trails-cool` discovery endpoint (apiVersion, instanceName, tileUrl, apiBaseUrl)
- [ ] 2.1.3 Implement `POST /api/v1/auth/token` (OAuth2 code-to-token exchange, refresh grant)

### 2.2 Routes Endpoints

- [ ] 2.2.1 Implement `GET /api/v1/routes` with cursor-based pagination
- [ ] 2.2.2 Implement `GET /api/v1/routes/:id` with full route detail (GPX, waypoints, versions)
- [ ] 2.2.3 Implement `POST /api/v1/routes` to create a new route
- [ ] 2.2.4 Implement `PUT /api/v1/routes/:id` to update a route (new version)
- [ ] 2.2.5 Implement `DELETE /api/v1/routes/:id`

### 2.3 Activities Endpoints

- [ ] 2.3.1 Implement `GET /api/v1/activities` with cursor-based pagination
- [ ] 2.3.2 Implement `GET /api/v1/activities/:id` with full activity detail
- [ ] 2.3.3 Implement `POST /api/v1/activities` to create a new activity
- [ ] 2.3.4 Implement `DELETE /api/v1/activities/:id`

### 2.4 Supporting Endpoints

- [ ] 2.4.1 Implement `POST /api/v1/routes/compute` BRouter proxy endpoint
- [ ] 2.4.2 Implement `POST /api/v1/uploads` presigned URL endpoint

### 2.5 Device Management

- [ ] 2.5.1 Store device name and last active timestamp on OAuth2 token use
- [ ] 2.5.2 Implement `GET /api/v1/auth/devices` — list connected devices for the authenticated user
- [ ] 2.5.3 Implement `DELETE /api/v1/auth/devices/:id` — revoke a device token

### 2.6 Validation & Testing

- [ ] 2.6.1 Add Zod validation middleware using schemas from `@trails-cool/api`
- [ ] 2.6.2 Unit tests for all API endpoints

## Phase 3: Routes

### 3.1 Route List

- [ ] 3.1.1 Build Routes tab screen with paginated route list fetched from Journal API
- [ ] 3.1.2 Display route cards with name, distance, elevation, and thumbnail map preview
- [ ] 3.1.3 Add pull-to-refresh and loading/error states
- [ ] 3.1.4 Add i18n keys for route list strings (en + de)

### 3.2 Route Detail

- [ ] 3.2.1 Build route detail screen with `react-native-maps` showing the route polyline and waypoint markers
- [ ] 3.2.2 Display route metadata: name, distance, elevation gain, number of days, waypoint list
- [ ] 3.2.3 Add "Edit", "Download Offline", and "Edit in Planner" action buttons
- [ ] 3.2.4 Style map markers and polyline colors to match the web Planner

### 3.3 Route Editing

- [ ] 3.3.1 Implement add-waypoint via long-press on map, inserting at the nearest route segment
- [ ] 3.3.2 Implement drag-to-move for waypoint markers
- [ ] 3.3.3 Implement waypoint deletion with confirmation
- [ ] 3.3.4 Add overnight stop toggle in waypoint detail sheet
- [ ] 3.3.5 Add POI snap suggestions when adding waypoints near known POIs
- [ ] 3.3.6 Integrate BRouter routing via Journal API proxy — recompute route segments on waypoint changes
- [ ] 3.3.7 Implement save: generate GPX from current waypoints + geometry, PUT to Journal API
- [ ] 3.3.8 Add unsaved-changes guard when navigating away from the editor

## Phase 4: Testing

### 4.1 Unit & Component Tests

- [ ] 4.1.1 Set up Jest + jest-expo + React Native Testing Library in `apps/mobile/`
- [ ] 4.1.2 Write unit tests for API client (mocked fetch, auth refresh, error handling)
- [ ] 4.1.3 Write component tests for route list, route detail, and route editor screens
- [ ] 4.1.4 Write unit tests for offline SQLite storage layer
- [ ] 4.1.5 Add test script to Turborepo pipeline

### 4.2 E2E Tests (Maestro)

- [ ] 4.2.1 Install Maestro CLI and create `apps/mobile/.maestro/` test directory
- [ ] 4.2.2 Write Maestro flow: login → see route list → open route detail
- [ ] 4.2.3 Write Maestro flow: edit route → add waypoint → save
- [ ] 4.2.4 Write Maestro flow: download route for offline → toggle airplane mode → view cached route
- [ ] 4.2.5 Configure Maestro CI integration with EAS Build (run E2E on preview builds)

## Phase 5: Offline

### 5.1 Route Download

- [ ] 5.1.1 Set up Expo SQLite database with tables for offline routes, waypoints, and edit queue
- [ ] 5.1.2 Implement route download: fetch GPX + metadata from API, store in SQLite
- [ ] 5.1.3 Build download progress UI with cancel support
- [ ] 5.1.4 Implement offline route loading — detect network state and load from SQLite when offline

### 5.2 Tile Cache

- [ ] 5.2.1 Implement tile download manager: given a route bounding box, download tiles at zoom levels 10-15
- [ ] 5.2.2 Store tiles in the file system via `expo-file-system` with a lookup index in SQLite
- [ ] 5.2.3 Configure `react-native-maps` to use cached tiles when offline
- [ ] 5.2.4 Add storage budget display and management on Profile tab (total cached size, delete individual routes)

### 5.3 Offline Edit Queue

- [ ] 5.3.1 Implement edit queue in SQLite: store pending route edits with timestamps
- [ ] 5.3.2 Add sync-pending indicator on routes with queued edits
- [ ] 5.3.3 Implement sync-on-reconnect: process queued edits in order via Journal API
- [ ] 5.3.4 Handle sync conflicts: warn user if server version changed, apply last-write-wins

## Phase 6: Polish

### 6.1 Deep Links

- [ ] 6.1.1 Configure `trailscool://` URL scheme in `app.config.ts` for iOS and Android
- [ ] 6.1.2 Implement deep link handler: parse `trailscool://routes/:id` and `trailscool://activities/:id`, navigate to detail screens
- [ ] 6.1.3 Implement "Edit in Planner" flow: open Planner URL in browser with JWT callback, handle return deep link
- [ ] 6.1.4 Add universal links / App Links for `https://trails.cool/routes/:id` (optional, requires associated domains)

### 6.2 App Store Preparation

- [ ] 6.2.1 Write App Store and Play Store descriptions (en + de) with screenshots
- [ ] 6.2.2 Add privacy nutrition labels for iOS (location, health, network) and Android data safety section
- [ ] 6.2.3 Configure EAS Submit for iOS App Store and Google Play
- [ ] 6.2.4 Set up over-the-air updates via EAS Update for non-native JS changes
- [ ] 6.2.5 Test full app flow end-to-end on physical iOS and Android devices

## Phase 7: Notifications

### 7.1 Journal Push Endpoints

- [ ] 7.1.1 Implement `POST /api/v1/push/subscribe` — store Web Push subscription for the authenticated user
- [ ] 7.1.2 Implement `DELETE /api/v1/push/unsubscribe` — remove a push subscription
- [ ] 7.1.3 Send Web Push notification when a shared route is updated

### 7.2 Push Relay Service

- [ ] 7.2.1 Build Web Push to APNs relay service (small Go or Node service)
- [ ] 7.2.2 Build Web Push to FCM relay service
- [ ] 7.2.3 Deploy relay service with Docker Compose alongside existing infrastructure

### 7.3 Mobile Push Integration

- [ ] 7.3.1 Register push token on mobile app startup via `expo-notifications`
- [ ] 7.3.2 Handle incoming push notifications — display and deep link on tap
