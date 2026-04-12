## Why

trails.cool is currently web-only: the Planner runs in a desktop browser and the Journal is a separate web app. On the road — at a campsite, at a trailhead, at a crossroads — users need their phone. The mobile browser experience works but is limited: no offline access, no HealthKit/GPS integration, no push notifications for shared route updates, and the two-app split (Planner + Journal) makes no sense on a phone where you want a single app that does both. A native mobile app (React Native + Expo) would unify planning and journaling, enable on-the-go route editing, and open the door to activity recording (GPS tracking) and health platform integration.

## What Changes

- **Unified mobile app**: A single React Native + Expo app that combines Planner and Journal functionality. Users authenticate with their Journal account and can browse routes, edit them, and record activities.
- **Shared packages**: Reuse `@trails-cool/types`, `@trails-cool/gpx`, `@trails-cool/i18n` in the mobile app. These are already pure TypeScript with no DOM dependencies.
- **Mobile route editing**: Simplified map-based route editing (add/move/delete waypoints, toggle overnight stops). Not full collaborative Yjs — instead, direct API edits to the Journal.
- **Offline route access**: Download route GPX + map tiles for offline use. View routes and waypoint details without connectivity.
- **Journal API client**: The mobile app talks to the Journal's existing API (auth, routes, activities). No new backend — the Journal is the source of truth.
- **Testing**: Jest + React Native Testing Library for unit/component tests, Maestro for E2E flows

## Capabilities

### New Capabilities
- `mobile-app-shell`: Expo app scaffold, navigation (tab bar: Map, Routes, Activities, Profile), authentication flow with Journal account
- `mobile-route-editor`: Map-based route editing on mobile — add/move/delete waypoints, overnight stops, POI snap. Direct saves to Journal API (no Yjs).
- `mobile-offline`: Download routes + map tile regions for offline viewing. Offline queue for edits synced when back online.
- `mobile-testing`: Jest + RNTL for unit/component tests, Maestro YAML flows for E2E
- `mobile-journal-client`: API client for Journal endpoints — auth, routes CRUD, activities CRUD, route versions

### Modified Capabilities
- `journal-auth`: Add OAuth2/PKCE flow for mobile app token exchange (existing passkey/magic-link auth doesn't work natively on mobile)
- `planner-journal-handoff`: Mobile app can open Planner web sessions via deep link for full collaborative editing when needed
- `shared-packages`: Verify and adapt `@trails-cool/types`, `@trails-cool/gpx`, `@trails-cool/i18n` for React Native compatibility (no DOM, no Node.js APIs)

## Impact

- **New repo/workspace**: `apps/mobile/` in the monorepo, React Native + Expo managed workflow
- **Shared packages**: `packages/types`, `packages/gpx`, `packages/i18n` need to work in React Native (linkedom dependency in gpx is Node-only — need browser DOMParser or a RN-compatible XML parser)
- **Journal API**: Existing routes/activities/auth endpoints used as-is. May need an OAuth2 token endpoint for mobile auth.
- **Maps**: React Native Maps (Google Maps/Apple Maps) instead of Leaflet (web-only). New map components, not shared with web.
- **Dependencies**: expo, react-native-maps, expo-location, expo-health, expo-file-system, expo-sqlite (offline cache)
- **App Store**: iOS App Store + Google Play distribution via EAS Build
