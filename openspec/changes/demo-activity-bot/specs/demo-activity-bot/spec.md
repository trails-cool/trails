## ADDED Requirements

### Requirement: Demo user bootstrap
The Journal SHALL ensure a dedicated bot user exists when the demo bot starts, creating it on first run if missing.

#### Scenario: Bot user created on first run
- **WHEN** the Journal worker starts with `DEMO_BOT_ENABLED=true` and no `users` row matches the reserved demo username
- **THEN** a new `users` row is inserted with the reserved username, a public-facing display name, a sentinel email (`demo@<domain>`), no passkey credentials, and `terms_accepted_at` + `terms_version` populated at the current version
- **AND** subsequent worker startups are idempotent — no second row is inserted

#### Scenario: Demo user has no usable credentials
- **WHEN** any request attempts to authenticate as the demo user via passkey or magic-link
- **THEN** authentication fails because no passkey is registered and no mailbox receives magic-link mails

### Requirement: Synthetic content generation job
The Journal SHALL run a recurring background job that generates one public route and one linked public activity for the demo user per run, subject to an env flag and a rate cap.

#### Scenario: Disabled in non-production environments
- **WHEN** the `DEMO_BOT_ENABLED` env var is absent or any value other than `"true"`
- **THEN** the job body is a no-op: no BRouter calls, no inserts, no errors

#### Scenario: Enabled generation flow (decide-to-walk fires)
- **WHEN** `DEMO_BOT_ENABLED=true`, the local hour is within 07:00–21:00, the per-tick Bernoulli roll fires, and the hard cap has not been reached
- **THEN** the job picks a random start and end point within the configured seed region, calls BRouter with the `trekking` profile, persists the returned GPX as a new route with `visibility='public'` and `synthetic=true`, and inserts a linked activity with the same GPX, `visibility='public'`, `synthetic=true`, a plausible `started_at` and `duration`, and a templated Bruno-voiced name/description
- **AND** the route and activity are attributed to the demo user

#### Scenario: Decide-to-walk does not fire
- **WHEN** the local hour is outside 07:00–21:00, or the Bernoulli roll does not fire
- **THEN** the job returns without inserting anything — Bruno just isn't walking right now

#### Scenario: BRouter failure is tolerated
- **WHEN** the BRouter call returns no route, a rate-limit, or an error
- **THEN** the job logs the failure, inserts nothing, and exits without throwing — the next scheduled tick retries

#### Scenario: Hard cap prevents runaway growth
- **WHEN** there are already 40 or more synthetic items created in the last 14 days
- **THEN** the job skips generation for that tick

#### Scenario: Singleton scheduling prevents overlap
- **WHEN** a tick fires while the previous run is still executing
- **THEN** the new tick is skipped (pg-boss singleton semantics) so the job cannot overlap itself

### Requirement: Synthetic content retention
The Journal SHALL run a recurring job that deletes synthetic routes and activities older than a configurable window.

#### Scenario: Prune removes old synthetic content
- **WHEN** the prune job runs with `DEMO_BOT_RETENTION_DAYS=14`
- **THEN** every row in `journal.routes` and `journal.activities` with `synthetic=true` and `created_at < now() - 14 days` is deleted
- **AND** route-version rows cascade-delete via existing foreign keys
- **AND** rows with `synthetic=false` are never touched

#### Scenario: Prune is a no-op when nothing is old
- **WHEN** the prune job runs and no synthetic rows exceed the retention window
- **THEN** no DELETE statements execute and the job returns normally

#### Scenario: Disabled in non-production environments
- **WHEN** `DEMO_BOT_ENABLED` is not `"true"`
- **THEN** the prune job body is a no-op

### Requirement: Initial backfill
On first enablement (when no synthetic content exists yet) the Journal SHALL populate the demo profile with a small batch of items so the first visitor does not see a single-item feed.

#### Scenario: First enablement backfills several items
- **WHEN** the bot is enabled for the first time and the count of synthetic routes is 0
- **THEN** the generation job produces 3–5 items in sequence during its first run
- **AND** subsequent runs produce one item at a time as normal

### Requirement: Seed region is configurable
The Journal SHALL read the seed region (bounding box) from an env var so the deployment can change it without a code change.

#### Scenario: Env-configured region
- **WHEN** `DEMO_BOT_REGION` is set to a JSON object containing a `bbox` array of four numbers `[west, south, east, north]`
- **THEN** all generated start and end points fall within that box

#### Scenario: Sensible default
- **WHEN** `DEMO_BOT_REGION` is unset
- **THEN** the job uses a documented default region (inner Berlin) so that out-of-the-box runs still produce plausible Bruno-style walks
