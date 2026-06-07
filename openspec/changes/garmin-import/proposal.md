## Why

Garmin is the largest fitness-device ecosystem our users own — and the most-requested missing import path. The connected-services framework was explicitly built so a second OAuth provider slots in behind the existing seams (`Importer`, `WebhookReceiver`, shared FIT→GPX), and after Wahoo and Komoot shipped, Garmin is the natural next provider to prove the framework holds for a push-first API.

## What Changes

- New provider `garmin` under `apps/journal/app/lib/connected-services/providers/garmin/` — manifest, OAuth2 (PKCE) config, `Importer` + `WebhookReceiver` capability adapters. Registered in the provider registry; settings UI, OAuth flow, and webhook routing light up without framework changes.
- Connect/disconnect Garmin from `/settings/connections` via Garmin's OAuth2 + PKCE flow; tokens stored as `credential_kind = 'oauth'` in `connected_services`.
- Automatic import of new activities via Garmin's **push model**: Garmin POSTs ping/push notifications to `/api/sync/webhook/garmin`; we fetch the FIT file from the notification's callback URL, convert via the shared `fit.ts`, and create the journal activity (idempotent via `sync_imports`).
- Historical import via Garmin's **backfill API**: unlike Wahoo, Garmin has no "list activities" endpoint — the import page requests backfill for a date range and the activities arrive asynchronously through the same webhook pipeline, with progress surfaced on the import page.
- Mandatory **deregistration handling**: Garmin sends a deregistration notification when a user revokes access from their end; we must mark the connection `revoked` (Garmin's terms additionally require ceasing data pulls for that user).
- Route push to Garmin devices (Courses API) is **out of scope** — it's a separate `RoutePusher` change once import has soaked, mirroring how `wahoo-route-push` followed `wahoo-import`.

## Capabilities

### New Capabilities
- `garmin-import`: Garmin Connect as an activity-import provider — OAuth2/PKCE connection, push-notification ingestion, date-range backfill for history, FIT conversion via the shared module, deregistration handling.

### Modified Capabilities

<!-- none — the connected-services framework requirements already cover a new provider registering manifest + capability adapters; nothing framework-level changes. That holding true is part of the point of this change. -->

## Impact

- **Code**: new `providers/garmin/` (manifest, importer, webhook, tests); one import line in `providers/index.ts`. Import page route for Garmin (backfill-request UX differs from Wahoo's pick-list, so it's a provider-specific page, not a reuse of the Wahoo one). i18n strings (en + de).
- **APIs**: `/api/sync/connect/garmin`, `/api/sync/disconnect/garmin`, `/api/sync/webhook/garmin` — all already routed generically by provider name.
- **Schema**: none. `connected_services` (`credential_kind = 'oauth'`) and `sync_imports` cover Garmin as-is.
- **Secrets/Env**: `GARMIN_CLIENT_ID`, `GARMIN_CLIENT_SECRET` (SOPS + compose wiring, same pattern as Wahoo).
- **External dependency / risk**: requires an approved **Garmin Connect Developer Program** application. Evaluation keys are rate-limited and production use needs Garmin's review. This gates rollout, not development — the importer/webhook can be built and tested against recorded fixtures first. Webhook endpoints must also be registered in Garmin's developer portal (not self-service via API).
- **Privacy manifest**: `/legal/privacy` gains a Garmin entry alongside Wahoo/Komoot (what we pull, what Garmin learns, deletion semantics).
