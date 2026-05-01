## 1. Pre-submission audit

- [ ] 1.1 Capture the current sandbox `fitness_app_id` (2156 at time of writing) and `client_id` for cross-reference after cutover.
- [ ] 1.2 Smoke-test connect / import / push / disconnect against sandbox one more time so we have a known-good baseline.

## 2. Register and submit the production app

- [ ] 2.1 Register a new production app in the Wahoo developer console (separate from the sandbox app).
- [ ] 2.2 Configure the production app's redirect URI as exactly `https://trails.cool/api/sync/callback/wahoo` and select all five scopes we use (`workouts_read`, `user_read`, `offline_data`, `routes_read`, `routes_write`).
- [ ] 2.3 Upload a trails.cool logo asset suitable for display next to routes/workouts in the Wahoo mobile app.
- [ ] 2.4 Submit the production review request with a concise description of trails.cool's use of the API (route planning + workout sync) and whatever supporting material Wahoo's form requires; capture that material list in `infrastructure/wahoo-production-app.md` so we have a paper trail.

## 3. React to Wahoo's review feedback

- [ ] 3.1 Respond to any clarification requests from Wahoo within 1 business day to keep the queue moving.
- [ ] 3.2 If Wahoo asks for spec/policy artifacts (privacy policy URL, screenshots, etc.), gather and resubmit; track each request as it comes in.

## 4. Cut over to production

- [ ] 4.1 Pre-announce the forced reconnect: short notice in release notes / status, plus an in-app banner on `/settings/connections` for users with an existing Wahoo connection.
- [ ] 4.2 Rotate `WAHOO_CLIENT_ID` and `WAHOO_CLIENT_SECRET` in `infrastructure/secrets.app.env` (SOPS-encrypted) to the new production credentials and redeploy via `cd-apps.yml`.
- [ ] 4.3 After deploy, confirm that existing `sync_connections` rows fail their next refresh cleanly and the user lands on the connect screen (rather than a stuck/error state).

## 5. Post-cutover verification

- [ ] 5.1 From a real Wahoo account, run the full happy path: connect → import a workout → push a route → confirm the route renders in the Wahoo mobile app with the trails.cool logo → disconnect.
- [ ] 5.2 Inspect the pushed route via `GET /v1/routes/:id` and confirm `file.url` is non-null and `fitness_app_id` matches the production app id.
- [ ] 5.3 Wait ~24h, then confirm the trails.cool logo is visible in the Wahoo app for the test route. If not, email Wahoo support.
- [ ] 5.4 Verify rate-limit headers (`X-RateLimit-Limit`) on a routine API call show the production tier (e.g., 5000 daily).

## 6. Documentation updates

- [ ] 6.1 Update `apps/journal/.env.example` with a one-line note that `WAHOO_CLIENT_ID` / `WAHOO_CLIENT_SECRET` are production-tier credentials.
- [ ] 6.2 Update `CLAUDE.md` (or wherever the local-HTTPS Wahoo note lives) to note the production tier and link this change for context.
- [ ] 6.3 Archive this change via `/opsx:archive` once verification is complete.
