# Tasks — garmin-import

## 1. Provider scaffold + OAuth

- [ ] 1.1 Create `providers/garmin/manifest.ts`: `credential_kind = 'oauth'`, Garmin OAuth2 endpoints, scopes, env-gated `GARMIN_CLIENT_ID`/`GARMIN_CLIENT_SECRET`; register via `providers/index.ts`
- [ ] 1.2 PKCE support in the Garmin authorize/exchange flow: generate code verifier, carry it through `oauth-state.server.ts` alongside the state nonce, send `code_challenge`/`code_verifier` on authorize/exchange (token *storage and refresh* stay on the existing oauth `CredentialAdapter`)
- [ ] 1.3 Capture the Garmin user id at connect time and store as `provider_user_id`
- [ ] 1.4 `/settings/connections` shows Garmin connect/disconnect; row hidden/disabled when env vars are absent (mirror Wahoo's gating); i18n strings (en + de)
- [ ] 1.5 Unit tests: manifest registration, PKCE parameter generation/verification, connect flow state round-trip

## 2. Webhook ingestion

- [ ] 2.1 `WebhookReceiver` adapter for `/api/sync/webhook/garmin`: accept POST, normalize ping (fetch callback URL) and push (inline payload) into one internal activity-notification shape, respond 200 fast
- [ ] 2.2 Callback-URL host allowlist (Garmin API hosts only) — drop + log anything else; never fetch unvalidated URLs (SSRF guard)
- [ ] 2.3 pg-boss job `garmin-import-activity`: resolve user via `provider_user_id`, fetch FIT via `withFreshCredentials`, convert via shared `fit.ts`, create activity (GPX + stats + geometry; stats-only when no FIT), record `sync_imports`; idempotent on duplicate notifications; respect 429/Retry-After in retry policy
- [ ] 2.4 Unknown-user notifications → 200, no processing; unknown notification types → log + 200
- [ ] 2.5 Tests with recorded notification + FIT fixtures: ping path, push path, dedupe, unknown user, SSRF rejection, FIT-less stats-only

## 3. Backfill (historical import)

- [ ] 3.1 Backfill request client: chunk a user-supplied date range into Garmin's per-request window; issue requests via `withFreshCredentials`
- [ ] 3.2 Import page `/settings/connections/garmin/import`: date-range form, list of requested ranges, count of imported activities per range, honest async messaging; i18n (en + de)
- [ ] 3.3 Persist backfill requests (range, requested_at, user) so progress survives reloads — smallest storage that works (reuse existing tables if possible; new table only if not)
- [ ] 3.4 Tests: chunking math, overlap re-request safety (dedupe via `sync_imports`), progress counting

## 4. Deregistration + lifecycle

- [ ] 4.1 Handle Garmin deregistration notifications: set `connected_services.status = 'revoked'`, short-circuit subsequent Garmin calls, surface the standard re-connect prompt
- [ ] 4.2 Tests: deregistration flips status; revoked connection blocks backfill/import paths

## 5. Provenance + docs

- [ ] 5.1 "Imported from garmin" badge works via the existing provenance path; delete-and-reimport clears `sync_imports`
- [ ] 5.2 Privacy manifest entry on `/legal/privacy` (en legal-manifest + de legal section): what we pull from Garmin, what Garmin learns, deletion/revocation semantics
- [ ] 5.3 Secrets wiring: `GARMIN_CLIENT_ID`/`GARMIN_CLIENT_SECRET` in SOPS `secrets.app.env`, compose env (prod + staging), `.env.example` notes

## 6. Rollout (gated on Garmin developer program approval)

- [ ] 6.1 Apply to the Garmin Connect Developer Program (operator); record approved scopes/limits and the confirmed backfill chunk window in design.md
- [ ] 6.2 Register staging webhook URL in the Garmin portal; soak on staging with a real device/account: connect → record → auto-import; backfill a month; revoke from Garmin side → `revoked`
- [ ] 6.3 Register production webhook URL; set production secrets; verify end-to-end on trails.cool
- [ ] 6.4 Resolve the design open question on FIT-less notifications (ingest stats-only vs skip) against real fixtures; update spec annotation if behavior differs
