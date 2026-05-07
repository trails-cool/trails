## Why

The current `SyncProvider` interface (`apps/journal/app/lib/sync/types.ts:88-118`) is OAuth-shaped: it bakes `getAuthUrl`, `exchangeCode`, `refreshToken`, `parseWebhook`, and `pushRoute?` into one fat interface. Wahoo is the only adapter today, and the abstraction is a hypothetical seam. With **Komoot** (web-login, no official API) and **Apple Health** (mobile-pushed, no remote credential) both in flight, that seam is about to break: a unified interface fills with NOPs and forces every future provider to inherit OAuth assumptions.

This change reshapes the seam *before* the second and third adapters land — so Komoot and Apple Health fit cleanly instead of distorting the architecture. Decisions are recorded in `docs/adr/0001-0003`; vocabulary in `CONTEXT.md`.

## What Changes

- **BREAKING (DB)**: rename `journal.sync_connections` → `journal.connected_services`. Add `credential_kind` text column (discriminator: `oauth | web-login | device`) and `credentials` JSONB column. Backfill existing Wahoo rows: `credential_kind='oauth'`, move `access_token / refresh_token / expires_at` into the JSONB blob. Drop the old token columns.
- **BREAKING (code)**: replace `SyncProvider` interface with three capability seams: `Importer`, `RoutePusher`, `WebhookReceiver`. Each provider declares which capabilities it implements via a co-located manifest (`providers/<name>/manifest.ts`); a small `providers/registry.ts` imports each.
- **New module** `ConnectedServiceManager` at `apps/journal/app/lib/connected-services/manager.ts` owning credential lifecycle: `link / unlink / withFreshCredentials / markNeedsRelink`. Centralizes token-refresh logic currently inlined in `pushes.server.ts` (~lines 145-170).
- **New per-kind module** `CredentialAdapter`. `oauth` adapter ships with this change (`refresh / revoke`). `web-login` adapter lands with `komoot-import`; `device` adapter lands with `mobile-app`. The `credential_kind` enum carries all three from day one to avoid a follow-up migration.
- **`RoutePusher` seam shape**: `pushRoute(service, route) → {remoteId, version}`. Wahoo's FIT-Course conversion, the `route:<id>` `external_id` convention, and the PUT→POST-on-404 fallback stay **inside the Wahoo adapter** — they are not part of the seam (per ADR-0003).
- Wahoo's existing code splits into `providers/wahoo/{importer.ts, pusher.ts, webhook.ts, manifest.ts}`; existing tests reorganize accordingly.
- **Spec deltas**: rename `sync_connections` → `connected_services` in `connected-services/spec.md`, `wahoo-import/spec.md`, `wahoo-route-push/spec.md`. Add capability-seam terminology to `connected-services/spec.md`.

## Capabilities

### New Capabilities

(none — this change reshapes existing capabilities, it does not introduce new user-visible behaviour.)

### Modified Capabilities

- `connected-services`: requirement-level changes — credential storage shape (`credential_kind` discriminator + JSONB), provider model (capability seams instead of unified `SyncProvider`), token-refresh policy (centralized via `ConnectedServiceManager.withFreshCredentials`).
- `wahoo-import`: rename of underlying table and refactor of how the importer obtains credentials (via manager, not via direct table read). User-visible behaviour unchanged.
- `wahoo-route-push`: rename of underlying table; `RoutePusher` seam shape codified. User-visible behaviour unchanged.

## Impact

- **Code**: `apps/journal/app/lib/sync/` is replaced by `apps/journal/app/lib/connected-services/` (manager + credential adapters + registry) and `apps/journal/app/lib/connected-services/providers/wahoo/` (split capability modules). Routes and jobs that read sync data update their imports.
- **DB**: one migration — rename + add columns + backfill + drop legacy columns. Production `connected_services` row count is small (sandbox era); backfill is online-safe.
- **Tests**: `wahoo.test.ts` (285 lines) and `pushes.server.test.ts` (309 lines) reorganize to test capabilities (`importer.test.ts`, `pusher.test.ts`, `webhook.test.ts`) against a fake `ConnectedServiceManager` yielding stub credentials. New `manager.test.ts` covers refresh / needs_relink transitions.
- **Specs**: 3 spec files updated (table rename + terminology). No removals.
- **Out of scope** (separate follow-on changes): `komoot-import` (will be amended to use this architecture instead of its drafted `journal.integrations` table); `mobile-app` (Apple Health provider lands there). Neither is touched by this change beyond a reference.
- **Decision references**: `docs/adr/0001-connected-services-credential-discriminator.md`, `docs/adr/0002-no-unified-syncprovider-interface.md`, `docs/adr/0003-routepusher-seam-shape.md`, `CONTEXT.md` (Connected Services section).
