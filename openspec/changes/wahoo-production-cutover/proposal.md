## Why

The trails.cool Wahoo Cloud API integration is currently registered as a **sandbox** application. Sandbox apps are rate-limited (250 req/day, 100/hr, 25 per 5 min) and Wahoo does not surface our logo or treat us as a first-class fitness app. To support real users at scale we need to be promoted to the production tier, which requires a Wahoo-side review of our app, scopes, redirect URI, and branding assets — none of which are visible in this codebase. This change captures the cutover as an auditable checklist so we don't lose track of the external steps and so we have a record of the sandbox-only quirks we already worked around.

## What Changes

- Submit our Wahoo app for production review and obtain production rate-limit tier (sandbox 250/day → production 5000/day; 25 per 5 min → 200; 100/hr → 1000/hr).
- Confirm all five requested scopes are configured on the production app: `workouts_read`, `user_read`, `offline_data`, `routes_read`, `routes_write`.
- Upload a trails.cool logo to Wahoo's developer console so it appears next to routes pushed by us in the Wahoo mobile app (logo is keyed off `fitness_app_id`, currently `2156` in sandbox).
- Verify the production app's redirect URI is exactly `https://trails.cool/api/sync/callback/wahoo` (Wahoo is byte-strict on this).
- Register a separate production app (Wahoo issues new `client_id`/`client_secret`) and plan a coordinated reauthorization for already-connected users — every existing Wahoo connection breaks at cutover and users are prompted to reconnect. Document the user-visible disruption.
- Document, for posterity, the sandbox-only workarounds we already shipped so future maintainers don't repeat the discovery cost: per-(app, user) unrevoked-token cap (revoke on disconnect — #346), `route[file]` must be a `data:application/vnd.fit;base64,...` URI (#349), FIT Course `capabilities` must include `valid|distance|position` not just `time` (#348).

This is an operations change, not a code change. No spec deltas — `wahoo-import` and `wahoo-route-push` describe behaviors that don't change between sandbox and production.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
<!-- None: this is an external/operational cutover. -->

## Impact

- **No application code changes.**
- **Secrets**: `infrastructure/secrets.app.env` is updated with the new production `client_id`/`client_secret` and the journal is redeployed.
- **Existing users**: every connected Wahoo user has to reauthorize once at cutover; the disconnect/connect UX already handles this, but we should communicate it ahead of time.
- **Wahoo developer console**: branding (logo), redirect URI, scopes — all set externally.
- **Documentation**: `apps/journal/.env.example` and CLAUDE.md may want a one-line note about which tier the app is on.
