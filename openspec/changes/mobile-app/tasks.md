## Phase 1: Foundation

### 1.1 App Scaffold

- [ ] 1.1.1 Initialize Expo managed project at `apps/mobile/` with TypeScript template
- [ ] 1.1.2 Configure pnpm workspace to include `apps/mobile` and resolve shared packages (`@trails-cool/types`, `@trails-cool/gpx`, `@trails-cool/i18n`)
- [ ] 1.1.3 Set up Expo Router with bottom tab navigation (Map, Routes, Activities, Profile) and placeholder screens
- [ ] 1.1.4 Add app icon, splash screen, and `app.config.ts` with bundle identifiers for iOS and Android
- [ ] 1.1.5 Configure EAS Build for development and preview profiles

### 1.2 API Contract Package

- [ ] 1.2.1 Create `packages/api/` with `API_VERSION` constant, endpoint path constants, and TypeScript types for all request/response shapes
- [ ] 1.2.2 Define route types: `RouteListResponse`, `RouteDetailResponse`, `CreateRouteRequest`, `UpdateRouteRequest`
- [ ] 1.2.3 Define activity types: `ActivityListResponse`, `ActivityDetailResponse`, `CreateActivityRequest`
- [ ] 1.2.4 Define auth types: `TokenExchangeRequest`, `TokenResponse`, `DiscoveryResponse`
- [ ] 1.2.5 Define shared error type: `ApiErrorResponse` with code, message, and optional field errors
- [ ] 1.2.6 Export everything from package index, add to pnpm workspace and Turborepo pipeline

### 1.3 Shared Package Compatibility

- [ ] 1.2.1 Audit `@trails-cool/types` for DOM/Node.js dependencies — confirm it's pure TypeScript interfaces
- [ ] 1.2.2 Refactor `@trails-cool/gpx` to use a platform-agnostic XML parser: use `linkedom` on Node.js and `DOMParser` on React Native/browser
- [ ] 1.2.3 Write unit tests for `parseGpx()` and `generateGpx()` running in a jsdom-free environment to verify no DOM dependency
- [ ] 1.2.4 Verify `@trails-cool/i18n` initializes in React Native — add an `initMobile()` export if the current init assumes a browser environment
- [ ] 1.2.5 Add `apps/mobile` to Turborepo pipeline (`turbo.json`) for build and typecheck

### 1.3 Journal Auth (OAuth2 PKCE)

- [ ] 1.3.1 Add `journal.oauth_clients` table with client_id, redirect_uri, and trusted flag
- [ ] 1.3.2 Add `journal.oauth_codes` table (code, userId, clientId, codeChallenge, codeChallengeMethod, expiresAt)
- [ ] 1.3.3 Add `journal.oauth_tokens` table (accessToken, refreshToken, userId, clientId, expiresAt)
- [ ] 1.3.4 Implement `GET /oauth/authorize` endpoint — show login UI, generate auth code on success, redirect to client
- [ ] 1.3.5 Implement `POST /oauth/token` endpoint — validate PKCE code_verifier, issue access + refresh tokens
- [ ] 1.3.6 Implement refresh token grant in `POST /oauth/token`
- [ ] 1.3.7 Add middleware to validate OAuth2 bearer tokens on existing API routes
- [ ] 1.3.8 Seed `trails-cool-mobile` as a trusted first-party OAuth2 client with `trailscool://` redirect URI
- [ ] 1.3.9 Write unit tests for PKCE challenge validation, token issuance, and token refresh

### 1.4 Server Configuration

- [ ] 1.4.1 Add server URL input on login screen with "Connect to a different server" toggle (defaults to `https://trails.cool`)
- [ ] 1.4.2 Add `GET /.well-known/trails-cool` discovery endpoint on the Journal — returns instance name, version, API base URL
- [ ] 1.4.3 Validate entered server URL by fetching discovery endpoint before proceeding to login
- [ ] 1.4.4 Check `apiVersion` semver from discovery against app's required minimum — block with upgrade prompt if server is too old
- [ ] 1.4.5 Persist server URL in Expo SecureStore, use as base for all API calls and OAuth2 flow
- [ ] 1.4.6 Re-check API version on app foreground (after background) — show banner if version mismatch detected
- [ ] 1.4.5 Add "Switch server" option on Profile tab — logs out, clears local data, returns to login

### 1.5 Journal API Client (Mobile)

- [ ] 1.4.1 Create `apps/mobile/src/lib/api-client.ts` with base HTTP client, auth header injection, and 401 auto-refresh logic
- [ ] 1.4.2 Create `apps/mobile/src/lib/auth.ts` with OAuth2 PKCE login flow using `expo-auth-session` and token storage via `expo-secure-store`
- [ ] 1.4.3 Implement routes API methods: listRoutes, getRoute, updateRoute, createRoute
- [ ] 1.4.4 Implement activities API methods: listActivities, getActivity, createActivity
- [ ] 1.4.5 Add typed error handling for network failures, 401, and server errors
- [ ] 1.4.6 Write unit tests for API client with mocked fetch responses

## Phase 2: Routes

### 2.1 Route List

- [ ] 2.1.1 Build Routes tab screen with paginated route list fetched from Journal API
- [ ] 2.1.2 Display route cards with name, distance, elevation, and thumbnail map preview
- [ ] 2.1.3 Add pull-to-refresh and loading/error states
- [ ] 2.1.4 Add i18n keys for route list strings (en + de)

### 2.2 Route Detail

- [ ] 2.2.1 Build route detail screen with `react-native-maps` showing the route polyline and waypoint markers
- [ ] 2.2.2 Display route metadata: name, distance, elevation gain, number of days, waypoint list
- [ ] 2.2.3 Add "Edit", "Download Offline", and "Edit in Planner" action buttons
- [ ] 2.2.4 Style map markers and polyline colors to match the web Planner

### 2.3 Route Editing

- [ ] 2.3.1 Implement add-waypoint via long-press on map, inserting at the nearest route segment
- [ ] 2.3.2 Implement drag-to-move for waypoint markers
- [ ] 2.3.3 Implement waypoint deletion with confirmation
- [ ] 2.3.4 Add overnight stop toggle in waypoint detail sheet
- [ ] 2.3.5 Add POI snap suggestions when adding waypoints near known POIs
- [ ] 2.3.6 Integrate BRouter routing via Journal API proxy — recompute route segments on waypoint changes
- [ ] 2.3.7 Implement save: generate GPX from current waypoints + geometry, PUT to Journal API
- [ ] 2.3.8 Add unsaved-changes guard when navigating away from the editor

## Phase 3: Testing

### 3.1 Unit & Component Tests

- [ ] 3.1.1 Set up Jest + jest-expo + React Native Testing Library in `apps/mobile/`
- [ ] 3.1.2 Write unit tests for API client (mocked fetch, auth refresh, error handling)
- [ ] 3.1.3 Write component tests for route list, route detail, and route editor screens
- [ ] 3.1.4 Write unit tests for offline SQLite storage layer
- [ ] 3.1.5 Add test script to Turborepo pipeline

### 3.2 E2E Tests (Maestro)

- [ ] 3.2.1 Install Maestro CLI and create `apps/mobile/.maestro/` test directory
- [ ] 3.2.2 Write Maestro flow: login → see route list → open route detail
- [ ] 3.2.3 Write Maestro flow: edit route → add waypoint → save
- [ ] 3.2.4 Write Maestro flow: download route for offline → toggle airplane mode → view cached route
- [ ] 3.2.5 Configure Maestro CI integration with EAS Build (run E2E on preview builds)

## Phase 4: Offline

### 4.1 Route Download

- [ ] 4.1.1 Set up Expo SQLite database with tables for offline routes, waypoints, and edit queue
- [ ] 4.1.2 Implement route download: fetch GPX + metadata from API, store in SQLite
- [ ] 4.1.3 Build download progress UI with cancel support
- [ ] 4.1.4 Implement offline route loading — detect network state and load from SQLite when offline

### 4.2 Tile Cache

- [ ] 4.2.1 Implement tile download manager: given a route bounding box, download tiles at zoom levels 10-15
- [ ] 4.2.2 Store tiles in the file system via `expo-file-system` with a lookup index in SQLite
- [ ] 4.2.3 Configure `react-native-maps` to use cached tiles when offline
- [ ] 4.2.4 Add storage budget display and management on Profile tab (total cached size, delete individual routes)

### 4.3 Offline Edit Queue

- [ ] 4.3.1 Implement edit queue in SQLite: store pending route edits with timestamps
- [ ] 4.3.2 Add sync-pending indicator on routes with queued edits
- [ ] 4.3.3 Implement sync-on-reconnect: process queued edits in order via Journal API
- [ ] 4.3.4 Handle sync conflicts: warn user if server version changed, apply last-write-wins

## Phase 5: Polish

### 5.1 Deep Links

- [ ] 5.1.1 Configure `trailscool://` URL scheme in `app.config.ts` for iOS and Android
- [ ] 5.1.2 Implement deep link handler: parse `trailscool://routes/:id` and `trailscool://activities/:id`, navigate to detail screens
- [ ] 5.1.3 Implement "Edit in Planner" flow: open Planner URL in browser with JWT callback, handle return deep link
- [ ] 5.1.4 Add universal links / App Links for `https://trails.cool/routes/:id` (optional, requires associated domains)

### 5.2 Push Notifications

- [ ] 5.2.1 Set up `expo-notifications` with push token registration
- [ ] 5.2.2 Add Journal API endpoint to register device push tokens
- [ ] 5.2.3 Send push notifications for route updates on shared routes (Journal server-side)
- [ ] 5.2.4 Handle notification taps — deep link to the relevant route or activity

### 5.3 App Store Preparation

- [ ] 5.3.1 Write App Store and Play Store descriptions (en + de) with screenshots
- [ ] 5.3.2 Add privacy nutrition labels for iOS (location, health, network) and Android data safety section
- [ ] 5.3.3 Configure EAS Submit for iOS App Store and Google Play
- [ ] 5.3.4 Set up over-the-air updates via EAS Update for non-native JS changes
- [ ] 5.3.5 Test full app flow end-to-end on physical iOS and Android devices
