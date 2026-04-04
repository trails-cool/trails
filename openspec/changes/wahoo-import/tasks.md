## 1. Sync Framework & Database

- [x] 1.1 Add `sync_connections` table to `packages/db/src/schema/journal.ts` (user_id FK, provider, access_token, refresh_token, expires_at, provider_user_id, created_at)
- [x] 1.2 Add `sync_imports` table (user_id FK, provider, external_workout_id, activity_id FK, imported_at)
- [x] 1.3 Define `SyncProvider` TypeScript interface in `apps/journal/app/lib/sync/types.ts`
- [x] 1.4 Create provider registry in `apps/journal/app/lib/sync/registry.ts` (array of providers, lookup by id)
- [x] 1.5 Create token storage helpers: `saveConnection()`, `getConnection()`, `deleteConnection()`, `updateTokens()` in `apps/journal/app/lib/sync/connections.server.ts`
- [x] 1.6 Create import tracking helpers: `recordImport()`, `isAlreadyImported()`, `getImportedIds()` in `apps/journal/app/lib/sync/imports.server.ts`
- [x] 1.7 Add WAHOO_CLIENT_ID and WAHOO_CLIENT_SECRET to `infrastructure/secrets.app.env` via SOPS
- [x] 1.8 Run `pnpm db:push` to apply schema changes

## 2. Wahoo Provider Implementation

- [x] 2.1 Create `apps/journal/app/lib/sync/providers/wahoo.ts` implementing `SyncProvider`
- [x] 2.2 Implement `getAuthUrl()` with scopes `workouts_read`, `user_read`, `offline_data`
- [x] 2.3 Implement `exchangeCode()` and `refreshToken()` using Wahoo's OAuth endpoints
- [x] 2.4 Implement `listWorkouts()` with pagination (Wahoo's `GET /v1/workouts`)
- [x] 2.5 Implement `downloadFile()` to fetch FIT file from Wahoo CDN
- [x] 2.6 Implement `parseWebhook()` to extract workout info from `workout_summary` payload

## 3. FIT → GPX Conversion

- [x] 3.1 Add `fit-file-parser` dependency
- [x] 3.2 Implement `convertToGpx()` in Wahoo provider: parse FIT, extract track records, convert semicircles to degrees, generate GPX via `generateGpx`
- [x] 3.3 Handle indoor workouts (no GPS) — return null GPX, create activity with stats only

## 4. OAuth Routes

- [x] 4.1 Create `apps/journal/app/routes/api.sync.connect.$provider.ts` — generates auth URL from provider, redirects
- [x] 4.2 Create `apps/journal/app/routes/api.sync.callback.$provider.ts` — exchanges code, stores tokens, redirects to settings
- [x] 4.3 Create `apps/journal/app/routes/api.sync.disconnect.$provider.ts` — deletes connection
- [x] 4.4 Register routes in `apps/journal/app/routes.ts`

## 5. Webhook Route

- [x] 5.1 Create `apps/journal/app/routes/api.sync.webhook.$provider.ts` — receives webhook, looks up user, downloads file, converts, creates activity
- [x] 5.2 Verify webhook by matching `provider_user_id` to a `sync_connection`
- [x] 5.3 Handle duplicate detection via `sync_imports`
- [x] 5.4 Register route in `routes.ts`

## 6. Import Page

- [x] 6.1 Create `apps/journal/app/routes/sync.import.$provider.tsx` — lists workouts with import buttons
- [x] 6.2 Show workout date, type, duration, distance per row
- [x] 6.3 Mark already-imported workouts via `sync_imports` lookup
- [x] 6.4 Import action: download file, convert, create activity, record import
- [x] 6.5 Pagination for workout list
- [x] 6.6 Register route in `routes.ts`

## 7. Settings Integration

- [x] 7.1 Add "Connected Services" section to settings page
- [x] 7.2 Iterate over registered providers to show connect/disconnect per provider
- [x] 7.3 Show connection status and link to import page when connected

## 8. i18n

- [x] 8.1 Add translation keys for sync UI (en + de): connect/disconnect, import page, webhook status, provider names

## 9. Testing

- [x] 9.1 Unit test: FIT→GPX conversion with sample FIT data
- [x] 9.2 Unit test: duplicate detection via sync_imports
- [x] 9.3 Unit test: OAuth URL generation and token exchange (mock fetch)
- [x] 9.4 E2E test: settings page shows Connected Services section
