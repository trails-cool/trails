## 1. Schema & job plumbing

- [ ] 1.1 Add `export_jobs` table to `packages/db` (id, user_id FK cascade, status, artifact_key, error, created_at, expires_at) + migration
- [ ] 1.2 Add `account-export` job type to `@trails-cool/jobs` and a daily sweep job that deletes expired artifacts + rows

## 2. Export generation

- [ ] 2.1 Implement the export assembler: batched queries per table (explicit column allowlists), streaming ZIP writer, layout per design (`routes/`, `activities/`, `media/`, `*.json`, `manifest.json` with formatVersion 1)
- [ ] 2.2 Stream media files from Garage into the archive; tolerate missing media gracefully
- [ ] 2.3 Upload artifact to storage under `exports/` with expiry metadata; mark job complete; fire "export ready" notification (existing notification pattern)
- [ ] 2.4 Unit tests: allowlists exclude token columns; manifest counts match; a synthetic large dataset stays within a memory budget; one-active-job constraint

## 3. UI & download

- [ ] 3.1 Settings surface: "Export my data" with request button, in-progress state, ready-with-expiry state (i18n en/de)
- [ ] 3.2 Owner-only download route streaming the artifact from storage; reject non-owners; 404 after expiry
- [ ] 3.3 E2E: request export on a seeded account → notification → download → assert archive contents (GPX count, manifest, no token fields)

## 4. Docs

- [ ] 4.1 Write `docs/export-format.md` (format version 1: layout + manifest schema)
- [ ] 4.2 Update privacy documentation: export exists, what it contains, expiry

## 5. Verification

- [ ] 5.1 Run `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e`
