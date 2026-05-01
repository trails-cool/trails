## Context

trails.cool's Wahoo integration was developed against a sandbox OAuth app. Sandbox is self-serve with low rate limits and no branding; production requires a Wahoo-side review where they verify our app, scopes, branding, and redirect URI before flipping the rate-limit tier and (likely) issuing production credentials. We have shipped working sandbox flows for both directions:

- **Inbound**: import workouts via `workouts_read` + `offline_data` (`wahoo-import` capability).
- **Outbound**: push routes via `routes_write` (`wahoo-route-push` capability), with `routes_read` recently added so we can round-trip-verify what Wahoo stored.

While building these we hit three Wahoo behaviors that aren't documented prominently and cost meaningful time:

1. **Per-(app, user) unrevoked-token cap.** Wahoo refuses new tokens with `"Too many unrevoked access tokens"` until the user revokes. We now call `DELETE /v1/permissions` on disconnect (#346).
2. **`route[file]` must be a data URI**, not raw base64. Sending raw base64 results in `file.url: null` server-side and an empty map in the Wahoo app (#349).
3. **FIT Course `capabilities` bitfield** must include `valid | distance | position` (`0x1A`); `0x04` ("time") alone misleads consumers (#348).

These are application-level fixes already in main. They are listed here so the cutover record explains why our sandbox testing surfaced them and so anyone redoing this integration in another fork has the receipts.

## Goals / Non-Goals

**Goals:**
- Get the trails.cool Wahoo app promoted to production rate limits.
- Ensure all five scopes we use are approved on production.
- Make sure the trails.cool logo appears in the Wahoo mobile app for routes/workouts associated with our `fitness_app_id`.
- Have a tested plan for whatever credential/redirect-URI changes Wahoo requires, including any forced reauthorization.

**Non-Goals:**
- No application code changes are planned by this cutover. If Wahoo's review surfaces something we have to change in code (e.g., they want a different OAuth scope set), that should be a separate, narrowly-scoped change.
- Not changing how `wahoo-import` or `wahoo-route-push` work — those specs are unaffected.
- Not introducing new providers or generalizing the sync framework.

## Decisions

**Treat this as an ops checklist, not a spec change.** Sandbox vs production is invisible to the application: same base URL (`api.wahooligan.com`), same OAuth endpoints, same response shapes. The only deltas are rate-limit ceilings and what Wahoo's UI shows. So the deliverable is a `tasks.md` that we work through, with the codebase untouched.

**Plan for a new production app, not in-place promotion.** Best read of Wahoo's flow is that production requires registering a separate app, which means new `client_id`/`client_secret` and a forced reauthorization for every currently-connected user. This is not data-destructive (we keep no Wahoo state besides tokens), but it is a one-time UX disruption we should announce. The sandbox app stays available as a fallback during cutover.

**Don't pre-empt Wahoo's review.** Submit, then react to whatever they ask. We have no signal that any spec or behavior needs to change before they look.

## Risks / Trade-offs

- **[Expected] Forced reauthorization for all current users.**
  Mitigation: pre-announce in release notes / status page; the connect UI is already prominent. Token revocation on our side already handles the case where a refresh fails (the user just sees "disconnected" and reconnects). Treat this as planned, not a surprise.
- **[Risk] Production rate limits still aren't enough at scale.**
  Mitigation: 5000/day across all users is generous for the current user count, but if the user base 10×s we'd need to ask Wahoo for a higher tier or move workouts polling behind webhooks (we already accept webhooks; we just don't depend on them yet).
- **[Risk] Logo not surfaced even after upload (Wahoo-side propagation delay).**
  Mitigation: verify by pushing a fresh route from a real account ~24h after logo upload; if not visible, email Wahoo support.

## Migration Plan

This is a coordinated external/internal cutover, not a code deploy.

1. Submit production review request via Wahoo developer console.
2. Wait for approval; respond to any questions.
3. On approval:
   - If credentials change: rotate `WAHOO_CLIENT_ID` / `WAHOO_CLIENT_SECRET` in `infrastructure/secrets.app.env`, redeploy.
   - If redirect URI changed (it shouldn't): re-register on Wahoo's side.
4. Smoke-test from a real account: connect, import a workout, push a route, disconnect.
5. Update CLAUDE.md / `.env.example` to note the app is on the production tier.

**Rollback:** if anything in step 3 breaks, revert the secrets to the sandbox credentials and redeploy. Sandbox app continues to work; users just see lower throughput.

## Open Questions

- What does Wahoo require in the production-review submission (description fields, screenshots, privacy policy URL, app store listing)? Need to discover this when filling out the request form.
- What's Wahoo's expected SLA on production review? Affects when we announce the forced-reconnect to users.
