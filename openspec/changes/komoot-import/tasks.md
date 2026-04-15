## 1. Database Schema

- [x] 1.1 Add `encryptedCredentials` column to `journal.sync_connections` table
- [x] 1.2 Add `journal.import_batches` table (id, userId, connectionId, status enum, totalFound, importedCount, duplicateCount, errorMessage, startedAt, completedAt)
- [x] 1.3 Reuse `journal.sync_imports` for deduplication (existing table from Wahoo sync)
- [x] 1.4 Add `source` column to `journal.routes` table (nullable, e.g. "komoot", "manual", "gpx-upload")
- [x] 1.5 Run `pnpm db:push` and verify schema locally

## 2. Credential Encryption

- [x] 2.1 Create `apps/journal/app/lib/crypto.server.ts` with AES-256-GCM encrypt/decrypt using `INTEGRATION_SECRET` env var
- [x] 2.2 Write unit tests for encrypt/decrypt roundtrip

## 3. Komoot API Client

- [x] 3.1 Create `apps/journal/app/lib/komoot.server.ts` with login function (email + password → username + token)
- [x] 3.2 Add fetchTours function (paginated, fetches all pages)
- [x] 3.3 Add fetchTourGpx function (fetch GPX geometry for a single tour)
- [x] 3.4 Write unit tests for API response parsing (mock fetch)

## 4. Import Logic

- [x] 4.1 Create `apps/journal/app/lib/komoot-import.server.ts` with importKomootTours function that: creates batch, pages through tours, fetches GPX, creates activities + routes, deduplicates via sync_imports, updates batch
- [x] 4.2 Write integration test for import with mock Komoot responses

## 5. API Routes

- [x] 5.1 Create `POST /api/integrations/komoot/connect` — validate credentials, store encrypted
- [x] 5.2 Create `POST /api/integrations/komoot/disconnect` — delete credentials
- [x] 5.3 Create `POST /api/integrations/komoot/import` — trigger import, return batch ID
- [x] 5.4 Create `GET /api/integrations/komoot/import-status` — return current batch progress

## 6. UI

- [x] 6.1 Create `/integrations` route with Komoot connection form (email + password)
- [x] 6.2 Show connected status, last sync time, and import button when connected
- [x] 6.3 Import progress UI — poll import-status, show counts (found, imported, duplicated)
- [x] 6.4 Add link to integrations page from Journal navigation
- [x] 6.5 Add i18n keys for all integration strings (en + de)

## 7. Privacy & Config

- [x] 7.1 Update /privacy page to document Komoot integration (credentials stored encrypted, what data is imported)
- [x] 7.2 Add `INTEGRATION_SECRET` env var to docker-compose.yml
- [x] 7.3 Add `INTEGRATION_SECRET` to deploy secrets (needs manual `sops` edit)

## 8. Verify

- [x] 8.1 Typecheck passes
- [x] 8.2 Lint passes
- [x] 8.3 All 79 unit tests pass
