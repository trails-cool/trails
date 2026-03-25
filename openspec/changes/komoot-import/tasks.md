## 1. Database Schema

- [ ] 1.1 Add `journal.integrations` table (id, userId, provider enum, encryptedCredentials, apiUsername, status, lastSyncedAt, createdAt)
- [ ] 1.2 Add `journal.import_batches` table (id, userId, integrationId, status enum, totalFound, importedCount, duplicateCount, errorMessage, startedAt, completedAt)
- [ ] 1.3 Add `dedupeKey` column to `journal.activities` table with unique constraint on (ownerId, dedupeKey)
- [ ] 1.4 Add `source` column to `journal.routes` table (nullable, e.g. "komoot", "manual", "gpx-upload")
- [ ] 1.5 Run `pnpm db:push` and verify schema locally

## 2. Credential Encryption

- [ ] 2.1 Create `apps/journal/app/lib/crypto.server.ts` with AES-256-GCM encrypt/decrypt using `INTEGRATION_SECRET` env var
- [ ] 2.2 Write unit tests for encrypt/decrypt roundtrip

## 3. Komoot API Client

- [ ] 3.1 Create `apps/journal/app/lib/komoot.server.ts` with login function (email + password → username + token)
- [ ] 3.2 Add fetchTours function (paginated, fetches all pages)
- [ ] 3.3 Add fetchTourGpx function (fetch GPX geometry for a single tour)
- [ ] 3.4 Write unit tests for API response parsing (mock fetch)

## 4. Import Logic

- [ ] 4.1 Create `apps/journal/app/lib/import.server.ts` with importKomootTours function that: creates batch, pages through tours, fetches GPX, creates activities + routes, deduplicates, updates batch
- [ ] 4.2 Write integration test for import with mock Komoot responses

## 5. API Routes

- [ ] 5.1 Create `POST /api/integrations/komoot/connect` — validate credentials, store encrypted
- [ ] 5.2 Create `POST /api/integrations/komoot/disconnect` — delete credentials
- [ ] 5.3 Create `POST /api/integrations/komoot/import` — trigger import, return batch ID
- [ ] 5.4 Create `GET /api/integrations/komoot/import-status` — return current batch progress

## 6. UI

- [ ] 6.1 Create `/integrations` route with Komoot connection form (email + password)
- [ ] 6.2 Show connected status, last sync time, and import button when connected
- [ ] 6.3 Import progress UI — poll import-status, show counts (found, imported, duplicated)
- [ ] 6.4 Add link to integrations page from Journal navigation
- [ ] 6.5 Add i18n keys for all integration strings (en + de)

## 7. Privacy & Config

- [ ] 7.1 Update /privacy page to document Komoot integration (credentials stored encrypted, what data is imported)
- [ ] 7.2 Add `INTEGRATION_SECRET` env var to docker-compose.yml and CI
- [ ] 7.3 Add `INTEGRATION_SECRET` to deploy secrets documentation

## 8. Verify

- [ ] 8.1 Test full flow locally: connect Komoot → import tours → verify activities + routes created
- [ ] 8.2 Verify deduplication: re-import and confirm no duplicates
- [ ] 8.3 Verify disconnect removes credentials
