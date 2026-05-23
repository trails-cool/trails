## Why

Users switching to trails.cool have years of tours on Komoot. Without import,
they start with an empty Journal — no history, no motivation to switch. A
Komoot import lets users bring their existing tours and start using
trails.cool immediately.

## What Changes

- **Public import** (no credentials): user proves ownership of their Komoot
  profile by placing their trails.cool profile URL in their Komoot bio field.
  trails.cool verifies via the public Komoot API, then imports all public tours.
- **Authenticated import** (email + password): imports all tours including
  private ones. Credentials stored encrypted.
- Both modes share the same batch import engine, progress tracking, and
  deduplication logic.

## Capabilities

### New Capabilities

- `komoot-import`: Two-mode Komoot import — public (bio verification, no
  credential storage) and authenticated (email + password, all tours including
  private). Both track batch progress and deduplicate on re-import.

### Modified Capabilities

- `route-management`: Routes can now be created via import (not just manual
  creation), with an external source tracking field.

## Impact

- **Database**: New tables for integration connections and import batches in
  `journal` schema. Connections can be credential-free (public mode).
- **Files**: New routes (`/integrations`, `/api/integrations/*`), new server
  utilities for Komoot API, new DB schema tables
- **Dependencies**: No new packages — uses fetch for Komoot API, existing
  Drizzle for DB
- **Privacy**: Only authenticated mode stores credentials (encrypted). Public
  mode stores only the Komoot username. Both documented in privacy manifest.
- **External**: Komoot public API (`api.komoot.de`) — unauthenticated for
  public tours and profile lookup; basic auth for authenticated mode
