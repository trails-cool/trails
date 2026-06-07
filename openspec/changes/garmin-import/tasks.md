# Tasks — garmin-import

## 1. Provider scaffold + OAuth

- [x] 1.1 Create `providers/garmin/manifest.ts`: `credential_kind = 'oauth'`, Garmin OAuth2 endpoints, scopes, env-gated `GARMIN_CLIENT_ID`/`GARMIN_CLIENT_SECRET`; register via `providers/index.ts`
- [x] 1.2 PKCE support in the Garmin authorize/exchange flow: generate code verifier, carry it through `oauth-state.server.ts` alongside the state nonce, send `code_challenge`/`code_verifier` on authorize/exchange (token *storage and refresh* stay on the existing oauth `CredentialAdapter`)
  > Design correction during apply: the `state` param is intent-encoding only (visible in redirects), not server-side storage — the verifier must never appear in a URL, so it rides a short-lived httpOnly cookie scoped to `/api/sync/callback` instead. Manifests opt in via `pkce: true`.
- [x] 1.3 Capture the Garmin user id at connect time and store as `provider_user_id`
- [x] 1.4 `/settings/connections` shows Garmin connect/disconnect; row hidden/disabled when env vars are absent (mirror Wahoo's gating); i18n strings (en + de)
- [x] 1.5 Unit tests: manifest registration, PKCE parameter generation/verification, connect flow state round-trip

## 2. Webhook ingestion

- [x] 2.1 `WebhookReceiver` adapter for `/api/sync/webhook/garmin`: accept POST, normalize ping (fetch callback URL) and push (inline payload) into one internal activity-notification shape, respond 200 fast
- [x] 2.2 Callback-URL host allowlist (Garmin API hosts only) — drop + log anything else; never fetch unvalidated URLs (SSRF guard)
- [x] 2.3 pg-boss job `garmin-import-activity`: resolve user via `provider_user_id`, fetch FIT via `withFreshCredentials`, convert via shared `fit.ts`, create activity (GPX + stats + geometry; stats-only when no FIT), record `sync_imports`; idempotent on duplicate notifications; respect 429/Retry-After in retry policy
- [x] 2.4 Unknown-user notifications → 200, no processing; unknown notification types → log + 200
- [x] 2.5 Tests with recorded notification + FIT fixtures: ping path, push path, dedupe, unknown user, SSRF rejection, FIT-less stats-only
  > Fixtures are doc-shaped (no live credentials yet — rollout 6.x); real recorded payloads replace them during the staging soak if shapes differ. The generic webhook route + Wahoo receiver moved to an array event contract (`parseWebhook(): WebhookEvent[]`) since Garmin batches notifications.

## 3. Backfill (historical import)

- [x] 3.1 Backfill request client: chunk a user-supplied date range into Garmin's per-request window; issue requests via `withFreshCredentials`
- [x] 3.2 Import page `/settings/connections/garmin/import`: date-range form, list of requested ranges, count of imported activities per range, honest async messaging; i18n (en + de)
- [x] 3.3 Persist backfill requests (range, requested_at, user) so progress survives reloads — smallest storage that works (reuse existing tables if possible; new table only if not)
  > Reused `import_batches` with two new nullable columns (`range_start`, `range_end`) — a smaller footprint than a new table, and provider-agnostic for future ranged backfills. (Deviates from the proposal's "Schema: none"; additive only.) Progress counts sync_imports rows since the request — notifications carry no batch id, so per-range attribution is a proxy by design.
- [x] 3.4 Tests: chunking math, overlap re-request safety (dedupe via `sync_imports`), progress counting

## 4. Deregistration + lifecycle

- [x] 4.1 Handle Garmin deregistration notifications: set `connected_services.status = 'revoked'`, short-circuit subsequent Garmin calls, surface the standard re-connect prompt
- [x] 4.2 Tests: deregistration flips status; revoked connection blocks backfill/import paths

## 5. Provenance + docs

- [x] 5.1 "Imported from garmin" badge works via the existing provenance path; delete-and-reimport clears `sync_imports`
- [x] 5.2 Privacy manifest entry on `/legal/privacy` (en legal-manifest + de legal section): what we pull from Garmin, what Garmin learns, deletion/revocation semantics
- [x] 5.3 Secrets wiring: `GARMIN_CLIENT_ID`/`GARMIN_CLIENT_SECRET` in SOPS `secrets.app.env`, compose env (prod + staging), `.env.example` notes

## 6. Rollout (gated on Garmin developer program approval)

- [ ] 6.1 Apply to the Garmin Connect Developer Program (operator); record approved scopes/limits and the confirmed backfill chunk window in design.md
- [ ] 6.2 Register staging webhook URL in the Garmin portal; soak on staging with a real device/account: connect → record → auto-import; backfill a month; revoke from Garmin side → `revoked`
- [ ] 6.3 Register production webhook URL; set production secrets; verify end-to-end on trails.cool
- [ ] 6.4 Resolve the design open question on FIT-less notifications (ingest stats-only vs skip) against real fixtures; update spec annotation if behavior differs
