## Why

Users with Wahoo cycling computers (ELEMNT, KICKR) record activities that are synced to Wahoo's cloud. Currently there's no way to get those activities into trails.cool without manually exporting GPX files. A direct Wahoo integration lets users connect their account once and have activities sync automatically.

This is the first of several planned device integrations (Garmin, Strava, Coros, etc.). The architecture should be provider-agnostic so adding new integrations is straightforward.

## What Changes

- **Provider abstraction**: A common interface for activity sync providers (OAuth2, webhook handling, activity listing, file download, format conversion). Wahoo is the first implementation.
- **OAuth2 flow**: "Connect Wahoo" button on the journal settings page. Redirects to Wahoo's authorization endpoint, handles callback, stores tokens.
- **Webhook sync**: Register for Wahoo's `workout_summary` webhook. When a new workout completes, automatically download the FIT file, convert to GPX, and create an activity.
- **Manual import**: Fallback import page for browsing and selectively importing older workouts.
- **FIT to GPX conversion**: Wahoo provides FIT format files. Convert to GPX server-side for storage.
- **Token management**: Store and refresh OAuth tokens per provider. Handle the 2-hour expiry with automatic refresh.

## Capabilities

### New Capabilities
- `activity-sync`: Provider-agnostic activity sync framework (OAuth2, webhooks, import, format conversion)
- `wahoo-import`: Wahoo-specific provider implementation (OAuth2 scopes, FIT files, webhook payload)

### Modified Capabilities
- `account-settings`: Add "Connected Services" section for managing provider connections
- `journal-auth`: Store OAuth tokens for external providers

## Impact

- `apps/journal/app/lib/sync/` — new directory for sync framework + provider implementations
- `apps/journal/app/routes/settings.tsx` — Connected Services section
- `apps/journal/app/routes/sync.*` — OAuth callback, webhook endpoint, import page
- `packages/db/src/schema/journal.ts` — `sync_connections` and `sync_imports` tables
- `infrastructure/secrets.app.env` — WAHOO_CLIENT_ID, WAHOO_CLIENT_SECRET
