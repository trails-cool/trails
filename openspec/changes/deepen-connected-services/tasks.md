## 1. Database migration

- [x] 1.1 Update Drizzle schema in `packages/db/src/schema/journal.ts`: rename `syncConnections` table to `connectedServices`, add `credentialKind` (text, NOT NULL) and `credentials` (jsonb, NOT NULL) and `status` (text, NOT NULL DEFAULT `'active'` with CHECK constraint for `active | needs_relink | revoked`); drop `accessToken`, `refreshToken`, `expiresAt`.
- [x] 1.2 Generate migration via `pnpm db:generate`; hand-edit if needed so backfill runs in the same transaction as the column adds (`UPDATE connected_services SET credential_kind = 'oauth', credentials = jsonb_build_object('access_token', access_token, 'refresh_token', refresh_token, 'expires_at', expires_at)`), then drop the old columns.
- [ ] 1.3 Verify the migration on a local database with seeded Wahoo connection rows; verify the inverse rollback restores the columns from JSONB.
- [x] 1.4 Update FK references in `sync_imports` and `sync_pushes` if any reference the table name (likely none — both reference `users` / `routes`, not connections).

## 2. ConnectedServiceManager + OAuth CredentialAdapter

- [x] 2.1 Create `apps/journal/app/lib/connected-services/types.ts` with `ConnectedService` record type, `CredentialKind`, `Credentials` (discriminated union per kind), `NeedsRelink` error class, `Status` enum.
- [x] 2.2 Create `apps/journal/app/lib/connected-services/credential-adapters/oauth.ts` implementing `CredentialAdapter` with `refresh(creds, providerConfig) → Credentials | NeedsRelink` and optional `revoke`.
- [x] 2.3 Create `apps/journal/app/lib/connected-services/manager.ts` exposing `link / unlink / withFreshCredentials / markNeedsRelink`. Persistence via Drizzle on the `connectedServices` table.
- [x] 2.4 Write `manager.test.ts`: in-memory tests with stub `CredentialAdapter` covering refresh-on-expired, refresh-fails-→-needs_relink, link/unlink, markNeedsRelink, status short-circuit.
- [x] 2.5 Write `credential-adapters/oauth.test.ts`: contract tests against a mocked token endpoint (refresh success, refresh 4xx → NeedsRelink).

## 3. Provider manifest + registry

- [x] 3.1 Create `apps/journal/app/lib/connected-services/registry.ts` and `types.ts` capability interfaces (`Importer`, `RoutePusher`, `WebhookReceiver`, `ProviderManifest`).
- [ ] 3.2 Create `apps/journal/app/lib/connected-services/providers/wahoo/manifest.ts` declaring `credentialKind: 'oauth'`, OAuth config (auth URL, token URL, scopes), and references to capability adapters.
- [ ] 3.3 Wire `providers/registry.ts` to import the Wahoo manifest. Expose `getManifest(providerId)` and `getAllManifests()`.

## 4. Wahoo capability adapters

- [ ] 4.1 Move and reshape Wahoo importer logic into `providers/wahoo/importer.ts` implementing the `Importer` seam (`listImportable`, `importOne`). Internally calls `withFreshCredentials` for any auth'd Wahoo HTTP. Keep FIT→GPX conversion isolated.
- [ ] 4.2 Move and reshape Wahoo route push logic into `providers/wahoo/pusher.ts` implementing `RoutePusher` (`pushRoute(service, route) → {remoteId, version}`). Keep FIT-Course conversion, `external_id = route:<id>`, the PUT-vs-POST decision, and the PUT→POST-on-404 fallback **inside** the adapter. Read/write `sync_pushes` per the existing idempotency rules.
- [ ] 4.3 Move and reshape Wahoo webhook handling into `providers/wahoo/webhook.ts` implementing `WebhookReceiver` (`parseWebhook`, `handle`).
- [ ] 4.4 Reorganize tests: split existing `wahoo.test.ts` (285 lines) and `pushes.server.test.ts` (309 lines) into `providers/wahoo/{importer.test.ts, pusher.test.ts, webhook.test.ts}` against a fake `ConnectedServiceManager` that yields stub credentials. Use `git mv` first, then split, so blame survives.

## 5. Caller migration

- [ ] 5.1 Update OAuth connect routes (`/api/sync/connect/wahoo`, callback) to call `ConnectedServiceManager.link` with `credentialKind: 'oauth'` and the JSONB credentials shape. Remove direct writes to the old token columns.
- [ ] 5.2 Update disconnect route (`/api/sync/disconnect/wahoo`) to call `ConnectedServiceManager.unlink`.
- [ ] 5.3 Update webhook route (`/api/sync/webhook/wahoo`) to look up the manifest via the registry and dispatch to its `WebhookReceiver`. Unknown `provider_user_id` still returns 200.
- [ ] 5.4 Update the route push action and any background jobs (`apps/journal/app/jobs/`) that previously called into `apps/journal/app/lib/sync/`. Replace direct `connections.server.ts` reads with `withFreshCredentials`.
- [ ] 5.5 Update the connections settings page (`/settings/connections`) and any UI surfaces reading `granted_scopes` to read from the `connected_services` row directly.
- [ ] 5.6 Delete the old `apps/journal/app/lib/sync/` directory once all imports are gone. Delete the old `SyncProvider` interface from `types.ts`.

## 6. Verification

- [ ] 6.1 Run `pnpm typecheck && pnpm lint && pnpm test` — all green.
- [ ] 6.2 Run `pnpm test:e2e` with the Wahoo flow specs — all green.
- [ ] 6.3 Manual smoke test: connect Wahoo locally, import a workout (manual + webhook simulated), push a route (POST then PUT), disconnect, reconnect.
- [ ] 6.4 Check that `connected_services` migration applies cleanly to a copy of staging data (or local seed reflecting prod).

## 7. Documentation + follow-up

- [ ] 7.1 Update `CONTEXT.md` if any term was sharpened during implementation.
- [ ] 7.2 File a follow-up issue/note to amend `openspec/changes/komoot-import/design.md` to use `connected_services` + `web-login` credential kind instead of the drafted `journal.integrations` table.
- [ ] 7.3 At archive time, apply the spec deltas in `specs/connected-services/`, `specs/wahoo-import/`, `specs/wahoo-route-push/` to `openspec/specs/`.
