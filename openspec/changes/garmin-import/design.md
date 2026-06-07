## Context

The connected-services framework (manifest + capability adapters + `ConnectedServiceManager`) shipped with Wahoo and was stress-tested by Komoot (a `web-login`/`public` provider). Garmin is the third provider and the first whose API is **push-first**: there is no "list my activities" REST endpoint to paginate. Garmin delivers data via webhook notifications — both for new activities and for requested historical backfills — which inverts the import flow the Wahoo UI assumes.

Garmin specifics that shape everything below (Garmin Connect Developer Program, Activity API):

- **Auth**: OAuth 2.0 with PKCE (their current scheme; OAuth 1.0a is legacy). Confidential client: token exchange and refresh use `client_id`/`client_secret` *plus* the PKCE verifier on the initial exchange. Access tokens are short-lived (~24 h), refresh tokens long-lived (~3 months).
- **Data delivery**: ping/push notifications POSTed to endpoints registered in the **developer portal** (not via API). *Ping* notifications carry a `callbackURL` from which we pull the payload; *push* notifications embed it. FIT files are fetched from a callback URL with the user's token.
- **History**: a *backfill* endpoint accepts a time range (chunked, bounded per request) and triggers asynchronous re-delivery of historical activities through the same notification pipeline.
- **Deregistration**: when a user revokes access on Garmin's side, Garmin sends a deregistration notification; partner terms require us to act on it.
- **Access**: requires an approved developer-program application; evaluation keys are rate-limited; production requires Garmin review.

## Goals / Non-Goals

**Goals:**
- Garmin connect/disconnect from `/settings/connections` with zero framework changes — the manifest/registry seams prove out on a third provider.
- New Garmin activities appear in the journal automatically (push pipeline → shared FIT→GPX → activity with stats + PostGIS geometry).
- Users can pull in their Garmin history via backfill requests with honest async progress UX.
- Garmin-side revocation degrades cleanly (`revoked` status, re-connect prompt, no orphaned polling).

**Non-Goals:**
- Route push to Garmin devices (Courses API) — a follow-up `RoutePusher` change once import has soaked, like `wahoo-route-push` after `wahoo-import`.
- Wellness/health data (Health API): steps, sleep, HR — out of scope; we import *activities* only.
- Real-time/live tracking.
- Supporting Garmin's legacy OAuth 1.0a.

## Decisions

### Decision: OAuth2 + PKCE rides the existing `oauth` credential kind

Garmin's token blob is shape-compatible with `OAuthCredentials` (`access_token`, `refresh_token`, `expires_at`), so `credential_kind = 'oauth'` and the existing OAuth `CredentialAdapter` handle storage and refresh. PKCE only affects the **authorize/exchange** steps, which are already per-provider in the manifest's OAuth config — the manifest gains a code-verifier generation + `code_challenge` parameter, with the verifier carried through the OAuth `state` storage (`oauth-state.server.ts`) the same way the existing flow carries its state nonce.

**Alternative considered:** a new `oauth-pkce` credential kind. Rejected — the *stored* credential is identical; PKCE is a handshake detail, not a credential shape. A new kind would fork the adapter for zero storage benefit.

### Decision: webhook-first ingestion; ping and push handled by one endpoint

`/api/sync/webhook/garmin` (generic provider webhook routing) accepts Garmin's notification POSTs. The handler normalizes both delivery styles — *ping* (fetch `callbackURL` for the payload) and *push* (payload inline) — into one internal "activity notification" shape, then: resolve user via `provider_user_id` (Garmin user id captured at connect time), fetch the FIT file, convert via shared `fit.ts`, create the activity, record `sync_imports`. Unknown users get a 200 (same don't-reveal-existence behavior as Wahoo). The endpoint must return 200 quickly — Garmin retries on failure and slow consumers get throttled — so FIT download + conversion runs as a pg-boss job (`garmin-import-activity`), mirroring the federation lesson that synchronous work in inbound webhooks is a trap.

**Alternative considered:** synchronous processing in the webhook (Wahoo does this today). Rejected for Garmin: backfill bursts deliver many notifications at once; a queue absorbs the burst and gives retries for transient FIT-download failures.

### Decision: backfill-request UX instead of a Wahoo-style pick list

Garmin has no list endpoint, so the import page (`/settings/connections/garmin/import`) is a **date-range backfill requester**: pick a range (chunked into Garmin's per-request window under the hood), submit, and watch activities arrive. Progress is honest-async: the page shows requested ranges and the count of activities imported so far (rows in `sync_imports` attributed to the backfill window), with a note that Garmin delivers asynchronously and large histories take time. No per-activity pick list, no "Import all" button — those concepts don't exist in a push model. Per-activity dedupe stays in `sync_imports`, so re-requesting an overlapping range is safe and cheap.

**Alternative considered:** caching a local index of summaries first and offering selection before FIT download. Rejected for v1 — it doubles the moving parts for marginal value (users overwhelmingly want "import everything since X"); selective deletion after import already exists.

### Decision: deregistration notifications flip status to `revoked`

Garmin's deregistration notification deletes nothing locally except the live link: we set `status = 'revoked'` on the `connected_services` row (the existing audit-retaining state), surface the standard re-connect prompt, and stop all Garmin API calls for that user. Imported activities stay — they're the user's data in their journal, consistent with the disconnect semantics in the connected-services spec. User-initiated *deletion* of imported content remains the existing per-activity/account deletion paths.

### Decision: fixtures-first development; Garmin program approval gates rollout, not build

The importer/webhook are built and tested against recorded notification + FIT fixtures (same pattern as Wahoo's tests), with the live integration soaked once program credentials exist. Webhook endpoint registration in Garmin's portal targets staging first (`staging.trails.cool`), then production — both registrable under one app. Secrets follow the SOPS + compose pattern (`GARMIN_CLIENT_ID`, `GARMIN_CLIENT_SECRET`).

## Risks / Trade-offs

- **Garmin program approval is external and slow** → fixtures-first build; the change is implementable and testable end-to-end without live credentials; rollout tasks are explicitly separated and can wait on Garmin without blocking merge (everything ships dark behind missing env vars, same as Wahoo on self-hosted instances).
- **Webhook delivery is best-effort; missed notifications mean missed activities** → backfill request doubles as a manual repair tool ("re-request last 7 days"); `sync_imports` dedupe makes overlap free.
- **Backfill bursts can spike load** → pg-boss queue with bounded concurrency for FIT download/conversion; webhook handler itself stays O(1).
- **Garmin rate limits (especially evaluation keys)** → respect 429/Retry-After in the job's retry policy; keep per-user backfill ranges chunked.
- **Ping `callbackURL` is attacker-controllable input if we blindly fetch it** → validate the callback host against Garmin's API host allowlist before fetching (SSRF guard — the federation work demonstrated exactly why).
- **Notification payload shapes are under-documented and shift between API versions** → normalize early into one internal shape with tolerant parsing; unknown notification types are logged and dropped (200), never 5xx.

## Migration Plan

1. Everything lands dark: no env vars → Garmin row hidden/disabled on `/settings/connections` (same gating as Wahoo's missing-client-id state).
2. Garmin developer program application (operator task, can run in parallel with implementation).
3. Staging: set secrets, register staging webhook URL in the Garmin portal, soak with a real Garmin account (connect → record activity → auto-import; backfill a month; revoke from Garmin side → `revoked`).
4. Production: same flag/secret pattern; privacy manifest entry ships with the code.
5. Rollback: remove secrets (provider hides), or disconnect-only — schema is untouched, so nothing to unwind.

## Open Questions

- Does our Garmin app get approved for the Activity API at production scale, and on what timeline? (Gates rollout tasks only.)
- Exact backfill chunk limit and burst rate for evaluation vs production keys — confirm against the current Activity API docs when credentials arrive; the chunking constant is one number in the manifest.
- Whether Garmin's notification includes enough summary data (duration/distance/type) to create stat-only activities for FIT-less entries (e.g. manually-logged workouts) — decide ingest-or-skip when fixtures are in hand; spec says ingest stats-only if the data is present, mirroring Wahoo's no-file behavior.
