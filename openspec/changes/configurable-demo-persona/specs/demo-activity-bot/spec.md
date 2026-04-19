## ADDED Requirements

### Requirement: Persona configuration
The Journal SHALL load a demo persona — username, display name, bio, supported locales, and per-locale content pools — from configuration at worker boot, and SHALL fall back to a built-in default persona if no override is supplied or the supplied override fails validation.

#### Scenario: No override supplied — built-in default applies
- **WHEN** the worker starts with `DEMO_BOT_ENABLED=true` and `DEMO_BOT_PERSONA` is unset
- **THEN** the bot uses the built-in default persona (`username=bruno`, playful Berlin-flavoured display name and bio, `locales=["en","de"]`, and the shipped Bruno-voiced name/description pools)
- **AND** behaviour is identical to the demo bot before this change

#### Scenario: Inline JSON override
- **WHEN** `DEMO_BOT_PERSONA` is set to a valid inline JSON object with `username`, `displayName`, `bio`, `locales`, and `content.names` / `content.descriptions` for each listed locale
- **THEN** the bot uses that persona — `ensureDemoUser` inserts a row with the persona's username/displayName/bio/sentinel email, and subsequent generated routes and activities draw names and descriptions from the persona's per-locale pools

#### Scenario: File-backed override
- **WHEN** `DEMO_BOT_PERSONA` is set to `file:<absolute-path>` and the referenced file contains a valid persona JSON object
- **THEN** the worker reads the file once at boot and uses its contents as the persona

#### Scenario: Invalid JSON or schema violation → fall back
- **WHEN** `DEMO_BOT_PERSONA` is set but the value is not valid JSON, or fails the persona schema (bad username pattern, empty or too-short pool, unsupported locale, etc.)
- **THEN** the worker logs a warn-level entry describing the first validation failure and uses the built-in default persona
- **AND** the bot continues to run

#### Scenario: File-backed path unreadable → fall back
- **WHEN** `DEMO_BOT_PERSONA=file:<path>` but the file cannot be read (missing, permission denied, not a file)
- **THEN** the worker logs a warn-level entry and uses the built-in default persona

### Requirement: Persona username clash detection
The Journal SHALL refuse to attach the demo bot to a pre-existing non-demo user account when the supplied persona username collides with a human user already registered on the instance.

#### Scenario: Configured username belongs to a real user
- **WHEN** the worker starts, the persona's username matches an existing `users` row, and that row has no marker identifying it as a prior demo user (i.e. it was registered via the normal signup flow)
- **THEN** the worker logs an error-level "demo persona username clash" entry naming the colliding username
- **AND** the generation + prune jobs are not scheduled for this process — the bot stays disabled until the operator picks a different username
- **AND** the rest of the Journal continues to serve requests normally

## MODIFIED Requirements

### Requirement: Demo user bootstrap
The Journal SHALL ensure a dedicated bot user exists when the demo bot starts, creating it on first run if missing. The user's identity (username, display name, bio, sentinel email local-part) is derived from the active persona — either the operator-supplied persona or the built-in default.

#### Scenario: Bot user created on first run
- **WHEN** the Journal worker starts with `DEMO_BOT_ENABLED=true` and no `users` row matches the persona's username
- **THEN** a new `users` row is inserted with that username, the persona's display name, the persona's bio, a sentinel email `<username>@<domain>`, no passkey credentials, and `terms_accepted_at` + `terms_version` populated at the current version
- **AND** subsequent worker startups are idempotent — no second row is inserted

#### Scenario: Demo user has no usable credentials
- **WHEN** any request attempts to authenticate as the demo user via passkey or magic-link
- **THEN** authentication fails because no passkey is registered and no mailbox receives magic-link mails

### Requirement: Synthetic content generation job
The Journal SHALL run a recurring background job that generates one public route and one linked public activity for the demo user per run, subject to an env flag and a rate cap. The generated name and description are drawn from the active persona's per-locale content pools.

#### Scenario: Disabled in non-production environments
- **WHEN** the `DEMO_BOT_ENABLED` env var is absent or any value other than `"true"`
- **THEN** the job body is a no-op: no BRouter calls, no inserts, no errors

#### Scenario: Enabled generation flow (decide-to-walk fires)
- **WHEN** `DEMO_BOT_ENABLED=true`, the local hour is within 07:00–21:00, the per-tick Bernoulli roll fires, and the hard cap has not been reached
- **THEN** the job picks a random start and end point within the configured seed region, calls BRouter with the `trekking` profile, persists the returned GPX as a new route with `visibility='public'` and `synthetic=true`, and inserts a linked activity with the same GPX, `visibility='public'`, `synthetic=true`, a plausible `started_at` and `duration`, and a persona-voiced name + description sampled from one of the persona's supported locales
- **AND** the route and activity are attributed to the demo user

#### Scenario: Locale restricted to a single language
- **WHEN** the persona's `locales` list is `["en"]`
- **THEN** every generated route's name and description come from the persona's English pool — the German pool is never sampled

#### Scenario: Decide-to-walk does not fire
- **WHEN** the local hour is outside 07:00–21:00, or the Bernoulli roll does not fire
- **THEN** the job returns without inserting anything

#### Scenario: BRouter failure is tolerated
- **WHEN** the BRouter call returns no route, a rate-limit, or an error
- **THEN** the job logs the failure, inserts nothing, and exits without throwing — the next scheduled tick retries

#### Scenario: Hard cap prevents runaway growth
- **WHEN** there are already 40 or more synthetic items created in the last 14 days
- **THEN** the job skips generation for that tick

#### Scenario: Singleton scheduling prevents overlap
- **WHEN** a tick fires while the previous run is still executing
- **THEN** the new tick is skipped (pg-boss singleton semantics) so the job cannot overlap itself
