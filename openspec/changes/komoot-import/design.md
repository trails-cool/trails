## Context

trails.cool Journal supports manual route creation and GPX import. Users coming
from Komoot have hundreds of tours they'd lose by switching. The old trails
project had a working Komoot integration using basic auth against Komoot's
undocumented API (`api.komoot.de`).

## Goals / Non-Goals

**Goals:**
- Connect Komoot account via email + password
- Import all tours (paginated) as activities + routes
- Track import progress with batch status
- Deduplicate on re-import (same tour never imported twice)
- Fetch GPX geometry per tour (not just metadata)

**Non-Goals:**
- OAuth flow (Komoot has no public OAuth — basic auth only)
- Real-time sync or webhook-based updates
- Strava/other providers (future iteration, but design the schema generically)
- Background job queue like Inngest (keep it simple — synchronous import with progress)

## Decisions

### D1: Generic integrations table with provider column

Store connections in a `journal.integrations` table with a `provider` enum
(`komoot`, and later `strava` etc). Credentials encrypted at rest. This avoids
a separate table per provider.

### D2: Import batches for progress tracking

Each import creates an `import_batches` row tracking: status (running,
completed, failed), total found, imported count, duplicate count, error message.
The UI polls this for progress.

### D3: Deduplication via composite key

Activities get a `dedupeKey` column. For Komoot: `komoot:{tourId}`. Combined
with `ownerId`, a unique constraint prevents duplicates. Insert uses
`onConflictDoNothing`.

### D4: Synchronous import with streaming progress

No background job queue. The import runs in an API route action that:
1. Fetches all tour pages from Komoot
2. For each tour, fetches GPX and creates activity + route
3. Updates the batch row with progress
4. Client polls `/api/integrations/komoot/import-status` for live updates

This keeps the architecture simple. If imports are too slow (>100 tours), we
can add a background worker later.

### D5: Encrypt credentials with AES-256-GCM

Use Node's `crypto.createCipheriv` with a server-side key derived from
`INTEGRATION_SECRET` env var. Decrypt on use, never log plaintext.

**Alternative considered**: Store only the API token (not email+password).
Rejected because the token may expire and re-auth requires the original
credentials.

## Risks / Trade-offs

- **Komoot API is undocumented** → Could break without notice. Mitigation: wrap
  all API calls in error handling, mark integration as "needs reauth" on 401.
- **Storing user passwords for third-party service** → Security risk.
  Mitigation: AES-256-GCM encryption, separate `INTEGRATION_SECRET`, document
  in privacy manifest.
- **Synchronous import may timeout for large accounts** → Mitigation: paginate
  and commit per-page. If a page fails, the batch is marked partial and can be
  resumed.
