## Context

Wahoo's Cloud API (https://cloud-api.wahooligan.com/) uses OAuth2 for authentication, provides workout data in FIT format, and supports webhooks for the `workout_summary` event. This is the first device integration — Garmin, Strava, and others will follow. The architecture must be provider-agnostic.

## Goals / Non-Goals

**Goals:**
- Provider-agnostic sync framework: common interface for OAuth2, webhooks, activity import
- Wahoo as first provider implementation
- Webhook-based automatic sync (new activities arrive without user action)
- Manual import for historical workouts
- FIT→GPX conversion for Wahoo's binary format
- Extensible to Garmin, Strava, Coros, etc.

**Non-Goals:**
- Two-way sync (no pushing data to providers)
- Importing structured workout plans or power zones
- Real-time streaming of in-progress activities

## Decisions

### D1: Provider interface

```typescript
interface SyncProvider {
  id: string;                    // "wahoo", "garmin", etc.
  name: string;                  // "Wahoo"
  scopes: string[];              // OAuth scopes needed

  getAuthUrl(state: string): string;
  exchangeCode(code: string): Promise<TokenSet>;
  refreshToken(refreshToken: string): Promise<TokenSet>;

  listWorkouts(tokens: TokenSet, page: number): Promise<WorkoutList>;
  downloadFile(tokens: TokenSet, workout: Workout): Promise<Buffer>;
  convertToGpx(fileBuffer: Buffer): Promise<string>;

  parseWebhook(body: unknown): WebhookEvent | null;
}
```

Each provider implements this interface. The framework handles OAuth flow, token storage, webhook routing, and activity creation. Adding a new provider means implementing one file.

### D2: Database schema

**`sync_connections`** — one row per user-provider pair:
- `id`, `user_id` (FK), `provider` (e.g., "wahoo"), `access_token`, `refresh_token`, `expires_at`, `provider_user_id`, `created_at`

**`sync_imports`** — tracks which external workouts have been imported:
- `id`, `user_id` (FK), `provider`, `external_workout_id`, `activity_id` (FK to activities), `imported_at`

This replaces the earlier `wahoo_tokens` table with a generic schema. No `wahoo_workout_id` column on activities — the `sync_imports` junction table handles duplicate detection for all providers.

### D3: Webhook sync

Wahoo sends `workout_summary` webhooks to a registered URL when a workout completes. Requires the `offline_data` OAuth scope.

**Webhook endpoint:** `POST /api/sync/webhook/wahoo`
- Verifies the request is from Wahoo (check payload structure)
- Looks up the user's `sync_connection` by `provider_user_id`
- Downloads the FIT file, converts to GPX, creates activity
- Stores import record in `sync_imports`

**Webhook registration:** Done via Wahoo's app settings dashboard (not API). The URL is `{ORIGIN}/api/sync/webhook/wahoo`.

### D4: OAuth2 flow

Standard authorization code flow. Scopes: `workouts_read`, `user_read`, `offline_data` (for webhooks).

**Routes:**
- `GET /api/sync/connect/wahoo` → redirect to Wahoo auth
- `GET /api/sync/callback/wahoo` → exchange code, store tokens, redirect to settings
- `POST /api/sync/disconnect/wahoo` → delete tokens

The route pattern `/api/sync/{action}/{provider}` is provider-agnostic — adding Garmin means the same routes with `garmin` instead of `wahoo`.

### D5: FIT→GPX conversion

Use `fit-file-parser` to parse FIT binary data. Extract records with `record_type === 'record'` containing `position_lat`, `position_long`, `altitude`, `timestamp`. FIT uses semicircles for coordinates — convert to degrees by dividing by `2^31 / 180`.

Convert to GPX using the existing `generateGpx` function, then feed through `setGeomFromGpx` for PostGIS geometry.

### D6: Manual import page

`/sync/import/wahoo` — lists workouts from Wahoo API with date, type, duration, distance. Marks already-imported ones via `sync_imports` lookup. Import button downloads FIT, converts, creates activity. Paginated (Wahoo returns 30 per page).

### D7: Settings integration

"Connected Services" section in settings. Shows each configured provider with connect/disconnect. When connected, shows provider user info and link to import page.

Provider registry:
```typescript
const providers = [wahooProvider]; // Add garminProvider, stravaProvider later
```

Settings iterates over registered providers to render the UI.

## Risks / Trade-offs

- **Webhook reliability:** If the webhook fails, the workout is missed. Mitigated by the manual import page as fallback, and idempotent import (duplicate detection via `sync_imports`).
- **FIT parsing:** Binary format parsing via npm package. If it fails for edge cases, the webhook silently drops that workout. Logging + manual import as fallback.
- **Provider-specific quirks:** Each provider has different OAuth flows, data formats, and webhook schemas. The interface abstracts the common pattern, but implementation details will vary. Accept some provider-specific code in each implementation file.
- **Webhook security:** Wahoo doesn't sign webhooks with HMAC. Verify by checking the `provider_user_id` in the payload matches a known `sync_connection`. This prevents arbitrary POST requests from creating activities.
