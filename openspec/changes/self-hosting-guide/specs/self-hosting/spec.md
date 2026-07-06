## ADDED Requirements

### Requirement: Minimal operator deployment example
The repository SHALL provide a self-contained example Docker Compose deployment (journal, planner, PostgreSQL/PostGIS, BRouter) configured via a plain env file, with healthchecks and pinned images, independent of the flagship infrastructure (no SOPS, no monitoring stack, single host).

#### Scenario: Fresh instance boots
- **WHEN** an operator copies the example compose and `.env.example`, fills the required variables, and runs `docker compose up`
- **THEN** all services become healthy and the journal and planner are reachable

### Requirement: Documented environment contract
`docs/self-hosting.md` SHALL document every environment variable the apps read — required/optional, default, and description — plus reverse-proxy guidance, the BRouter segment-region decision, and BYO provider-credential setup (Wahoo and future providers) including redirect URIs.

#### Scenario: Env vars discoverable without reading code
- **WHEN** an operator needs to configure SMTP or provider credentials
- **THEN** the variable names, formats, and where to obtain values are in the guide

#### Scenario: Undocumented variable fails CI
- **WHEN** a new variable is added to an app's `.env.example` without a guide entry
- **THEN** the documentation check fails

### Requirement: No default secrets, fail-fast on misconfiguration
The example deployment SHALL ship no working secret values (placeholders + generation commands only), and the journal SHALL refuse to start when a required secret is missing or still a placeholder, logging a message that links to the self-hosting guide.

#### Scenario: Placeholder secret blocks startup
- **WHEN** an operator starts the journal with the `.env.example` placeholder secret unchanged
- **THEN** the process exits with a clear error naming the variable and linking to the guide

### Requirement: Upgrade and backup procedures
The guide SHALL document upgrading (image bump; schema migrations applied via the documented mechanism) and backup/restore: nightly PostgreSQL dump, media storage copy, and restore steps — including what not to back up (raw DB volume copies while running).

#### Scenario: Operator restores from backup
- **WHEN** an operator follows the restore procedure with a dump + media copy
- **THEN** the instance comes back with all user data intact

### Requirement: CI-verified example deployment
CI SHALL boot the example compose (on changes to it, the guide, or app images, and on a weekly schedule), wait for health, and verify the journal health endpoint, a planner page load, and a BRouter route computation.

#### Scenario: Broken example blocks merge
- **WHEN** an app change breaks the example deployment
- **THEN** the smoke job fails on the PR
