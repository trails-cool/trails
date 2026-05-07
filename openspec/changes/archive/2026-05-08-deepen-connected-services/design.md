## Context

`apps/journal/app/lib/sync/` today uses a unified `SyncProvider` interface (`types.ts:88-118`) with one adapter (Wahoo). The interface bakes OAuth into its shape — `getAuthUrl`, `exchangeCode`, `refreshToken`, `parseWebhook`, plus optional `pushRoute? / updateRoute? / revoke?`. Token-refresh logic lives inline in `pushes.server.ts` (~lines 145-170). The CRUD layer (`connections.server.ts`) is a thin wrapper over the `sync_connections` table.

Two new providers are imminent and each violates the OAuth assumption: **Komoot** (no official API; we authenticate via the website's login form and reuse session cookies — `credential_kind = web-login`) and **Apple Health** (no remote credential at all; data arrives via authenticated mobile API uploads — `credential_kind = device`). Hand-merging either into the current shape produces NOPs (`refreshToken`, `parseWebhook`) and OAuth-shaped queries.

Three architectural decisions have already been recorded:
- ADR-0001: credential-kind discriminator + JSONB blob (not OAuth-only schema, not per-kind tables).
- ADR-0002: capability seams (`Importer` / `RoutePusher` / `WebhookReceiver`), not a unified `SyncProvider`.
- ADR-0003: `RoutePusher` interface shape is `(service, route) → {remoteId, version}`; Wahoo workarounds stay inside the adapter.

Domain vocabulary is in `CONTEXT.md` (Connected Services section).

## Goals / Non-Goals

**Goals:**
- Reshape the `sync_connections` storage and the `SyncProvider` interface *before* Komoot or Apple Health code lands, so neither has to distort the architecture.
- Centralize credential lifecycle (refresh / mark-needs-relink) in one module so future providers don't reinvent it.
- Make capability seams (`Importer`, `RoutePusher`, `WebhookReceiver`) testable independently with a fake `ConnectedServiceManager`.
- Commit to a `RoutePusher` shape with one adapter today, so Coros / Garmin / Strava push won't reshape it.
- Carry all three credential kinds (`oauth | web-login | device`) in the schema enum from day one to avoid follow-up migrations.

**Non-Goals:**
- Adding the Komoot importer or `web-login` `CredentialAdapter` (lands with the amended `komoot-import` change).
- Adding the Apple Health adapter or `device` `CredentialAdapter` (lands with `mobile-app`).
- Changing user-visible behaviour (settings page, OAuth flows, import / push semantics, webhook handling, idempotency rules).
- Touching `sync_imports` or `sync_pushes` schema. Only `sync_connections` is renamed.
- Defining cross-provider behaviour beyond credential lifecycle. `Importer` and `WebhookReceiver` are typed seams but their per-provider mechanics stay heterogeneous.

## Decisions

### Decision 1: One `connected_services` table, polymorphic credentials

`sync_connections` is renamed to `connected_services`. New columns:
- `credential_kind text NOT NULL` — discriminator: `oauth | web-login | device`.
- `credentials jsonb NOT NULL` — shape determined by `credential_kind`. For `oauth`: `{access_token, refresh_token, expires_at}`. For `web-login` (later): `{email, encrypted_password, session_jar}`. For `device` (later): `{}`.

Top-level columns kept: `user_id`, `provider`, `provider_user_id` (nullable), `granted_scopes` (nullable text[], populated only for `oauth`), `created_at`. Old columns `access_token / refresh_token / expires_at` are dropped after backfill.

**Why JSONB + discriminator instead of nullable OAuth columns or per-kind tables**: see ADR-0001. Short version: nullable OAuth makes Komoot and Apple Health leave half the columns NULL; per-kind tables fragment the user-facing "Connected Services" list and complicate the registry.

**`granted_scopes` stays a top-level column** because feature gates (`if (!granted_scopes.includes('routes_write')) re-auth`) read it on every push. Promoting it out of JSONB keeps gate queries cheap and untyped JSONB indexing unnecessary.

### Decision 2: Capability seams, not a unified provider

`SyncProvider` is replaced by three interfaces, each implementable independently:

```ts
interface Importer {
  listImportable(service, page): Promise<ImportableList>;
  importOne(service, id): Promise<ImportResult>;
}

interface RoutePusher {
  pushRoute(service, route): Promise<{remoteId, version}>;
}

interface WebhookReceiver {
  parseWebhook(body, headers): WebhookEvent | null;
  handle(event): Promise<void>;
}
```

A `Provider` is a manifest co-located with its code:

```ts
// providers/wahoo/manifest.ts
export const wahoo: ProviderManifest = {
  id: 'wahoo',
  credentialKind: 'oauth',
  oauth: { /* getAuthUrl, exchangeCode, scopes */ },
  importer: wahooImporter,
  pusher: wahooPusher,
  webhookReceiver: wahooWebhook,
};
```

`providers/registry.ts` imports each manifest. Adding a provider is one new directory plus one import line. Per ADR-0002, there is no pan-provider behaviour interface — the manager owns credential lifecycle, capability adapters own everything else.

**Why this over a unified interface with optional methods**: Wahoo's current interface has three optional methods already (`pushRoute? / updateRoute? / revoke?`); the codebase has been informally drifting toward capability seams. Formalizing it makes "does Komoot push? does Apple Health webhook?" a manifest-level fact rather than a runtime `if (provider.pushRoute)` check.

### Decision 3: `ConnectedServiceManager` owns credential lifecycle

```ts
class ConnectedServiceManager {
  link(userId, providerId, kind, credentials): Promise<ConnectedService>;
  unlink(serviceId): Promise<void>;
  withFreshCredentials<T>(serviceId, fn: (creds) => Promise<T>): Promise<T>;
  markNeedsRelink(serviceId, reason): Promise<void>;
}
```

`withFreshCredentials` is the chokepoint. It loads the row, checks if the credential is expired (per-kind logic via `CredentialAdapter`), refreshes if needed, calls `fn(credentials)`, and on credential failure flips `status = needs_relink`. Importers, pushers, and webhook handlers always go through this — they never read the `credentials` JSONB directly.

**Why centralize**: today's refresh logic lives inline in `pushes.server.ts` (~lines 145-170). Komoot's relogin and Apple Health's noop need the same chokepoint. One module = one place where credential bugs and races are caught.

### Decision 4: `oauth` `CredentialAdapter` ships now; `web-login` and `device` are stubs

```ts
interface CredentialAdapter {
  refresh(credentials): Promise<Credentials | NeedsRelink>;
  revoke?(credentials): Promise<void>;
}
```

The `oauth` adapter ships with this change and contains the existing Wahoo-style refresh-token flow plus optional revoke (for providers that support `DELETE /v1/permissions`). The `web-login` and `device` adapters are not implemented in this change — they land with their respective consumer changes. The discriminator enum carries all three values from day one so the consumer changes don't need a migration.

### Decision 5: `RoutePusher` shape commits to (service, route) → result

Per ADR-0003, the seam is:

```ts
interface RoutePusher {
  pushRoute(service: ConnectedService, route: Route): Promise<{remoteId: string, version: number}>;
}
```

Wahoo's adapter handles internally:
- FIT-Course conversion via `gpxToFitCourse`.
- The `external_id = route:<id>` convention.
- The PUT-vs-POST decision based on `sync_pushes.remote_id`.
- The PUT→POST-on-404 fallback when the user deleted the Wahoo route on their side.
- The `data:application/vnd.fit;base64,...` body encoding.

Idempotency tracking via `sync_pushes (user_id, route_id, provider) → remote_id, last_pushed_version` is the **shared** contract — every adapter must read/write this table — but how it's used (PUT vs POST, fallback) is adapter-internal.

### Decision 6: Spec deltas are renames + capability-seam terminology

Three spec files are touched:
- `connected-services/spec.md`: rename `sync_connections` → `connected_services` everywhere; add a requirement codifying the capability-seam model (replacing the implicit "OAuth tokens stored in" framing).
- `wahoo-import/spec.md`: rename. The "Provider-agnostic sync framework" requirement is rewritten to reference capability seams + manifest registration instead of "implement the `SyncProvider` interface in a single file."
- `wahoo-route-push/spec.md`: rename only. User-visible behaviour and idempotency rules are unchanged.

## Risks / Trade-offs

- **[Risk]** Migration runs on production `connected_services` rows (sandbox era — small, but non-zero) — botched backfill could leave Wahoo connections unusable until manual repair. → **Mitigation**: migration is a single transaction; backfill is purely column-shape (no value transformation beyond moving three columns into a JSON object); deploy with a dry-run on staging first; rollback = re-run the inverse migration restoring columns from JSON.

- **[Risk]** OpenSpec change `komoot-import` already drafts a `journal.integrations` table — any in-progress implementation against that drafted spec becomes wasted work. → **Mitigation**: this change documents the supersession explicitly. The `komoot-import` design.md will be amended in a separate, small follow-up before any Komoot code lands; if Komoot work has already started against the old shape, it is small and isolated (one importer file, no shipped DB).

- **[Trade-off]** Carrying `web-login` and `device` in the `credential_kind` enum without their adapters means an empty enum branch ships. The alternative (add the values when their adapters land) costs an extra migration each. → **Accepted**: enum-only forward declaration is cheap; migration churn is not.

- **[Trade-off]** `RoutePusher` is a single-adapter seam today. Per ADR-0003 we commit to its shape now to avoid a reshape when Coros/Garmin/Strava push lands. **Accepted** because the shape is small (`(service, route) → {remoteId, version}`) and Wahoo specifics already live behind it.

- **[Risk]** Test reorganization (existing `wahoo.test.ts` and `pushes.server.test.ts` split into `importer.test.ts` / `pusher.test.ts` / `webhook.test.ts` / `manager.test.ts`) loses git blame continuity. → **Mitigation**: do the file moves with `git mv` in the same commit as the code split; reviewers can use `--follow` to trace history.

## Migration Plan

Single deployable PR ("spec apply") containing:

1. **DB migration** (Drizzle): rename `sync_connections` → `connected_services`; add `credential_kind text NOT NULL` (default `'oauth'` only for the duration of backfill, then drop default); add `credentials jsonb NOT NULL`; add `status text NOT NULL DEFAULT 'active'`; backfill `credentials = jsonb_build_object('access_token', access_token, 'refresh_token', refresh_token, 'expires_at', expires_at)`; drop `access_token / refresh_token / expires_at`.
2. **New module** `apps/journal/app/lib/connected-services/` (manager + oauth credential adapter + registry + types).
3. **Wahoo split**: `apps/journal/app/lib/sync/providers/wahoo.ts` is moved to `apps/journal/app/lib/connected-services/providers/wahoo/{importer.ts, pusher.ts, webhook.ts, manifest.ts, oauth.ts}`. The old `sync/` directory is deleted.
4. **Caller updates**: routes (`api.sync.connect.*`, `api.sync.disconnect.*`, `api.sync.webhook.wahoo`), background jobs, and the route push action update their imports to go through the manager + registry.
5. **Test reorganization**: `wahoo.test.ts` (285 lines) and `pushes.server.test.ts` (309 lines) split into capability-aligned test files; new `manager.test.ts` covers refresh / needs_relink / link / unlink.
6. **Spec deltas** applied at archive time.

**Rollback**: revert the PR. The inverse migration restores `access_token / refresh_token / expires_at` from the JSONB blob and renames the table back. Production has small row count, so the inverse runs in seconds.

## Open Questions

- **Q1**: Should `connected_services.status` be an enum (`active | needs_relink | revoked`) at the DB level, or a free-form text column with constants in code? → **Lean toward enum** (Postgres `text` with a `CHECK` constraint) so a stray status value can't slip in. Decide during implementation.
- **Q2**: Where does the `oauth` `CredentialAdapter` live — `lib/connected-services/credential-adapters/oauth.ts` or co-located inside `providers/wahoo/`? Wahoo's OAuth-specific config (token endpoint URL, client id) needs to be accessible to the adapter. → **Lean toward shared adapter at `credential-adapters/oauth.ts`** taking the provider-specific config from the manifest. Decide during implementation.
- **Q3**: Does the `oauth` adapter handle revoke universally (call `provider.revokeUrl` if defined), or is revoke a Wahoo-internal concern? → **Lean toward shared with optional config**, since Strava and Garmin also have revoke endpoints.
