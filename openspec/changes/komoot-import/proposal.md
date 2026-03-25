## Why

Users switching to trails.cool have years of tours on Komoot. Without import,
they start with an empty Journal — no history, no motivation to switch. A
one-click Komoot import lets users bring their existing tours and start using
trails.cool immediately.

## What Changes

- Add Komoot account connection flow (email + password → API credentials)
- Import Komoot tours as Journal activities with route data
- Batch import with progress tracking, deduplication, and error handling
- Integration settings page to manage connected accounts and trigger imports
- Fetch full tour GPX (not just metadata) so imported routes have geometry

## Capabilities

### New Capabilities

- `komoot-import`: Connect a Komoot account, import tours as activities with routes, track import progress, deduplicate on re-import

### Modified Capabilities

- `route-management`: Routes can now be created via import (not just manual creation), with an external source tracking field

## Impact

- **Database**: New tables for integration connections and import batches in `journal` schema
- **Files**: New routes (`/integrations`, `/api/integrations/*`), new server utilities for Komoot API, new DB schema tables
- **Dependencies**: No new packages needed — uses fetch for Komoot API, existing Drizzle for DB
- **Privacy**: Komoot credentials stored encrypted. Must be documented in privacy manifest.
- **External**: Komoot API (api.komoot.de) — basic auth, no official developer program
