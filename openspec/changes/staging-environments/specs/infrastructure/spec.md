## MODIFIED Requirements

### Requirement: Caddy reverse proxy routing
Caddy SHALL route requests to staging and PR preview containers via per-host site blocks, in addition to the existing production routing.

#### Scenario: Staging subdomain routing
- **WHEN** a request arrives for `staging.trails.cool`
- **THEN** Caddy proxies it to the staging journal container on port 3100

#### Scenario: Planner staging routing
- **WHEN** a request arrives for `planner.staging.trails.cool`
- **THEN** Caddy proxies it to the staging planner container on port 3101

#### Scenario: PR preview routing
- **WHEN** a request arrives for `pr-123.staging.trails.cool`
- **THEN** Caddy proxies it to the PR 123 journal container on its assigned port (`3200 + 2N`)

#### Scenario: Per-PR Caddyfile snippet lifecycle
- **WHEN** a PR preview is deployed
- **THEN** the cd-staging workflow writes a Caddyfile snippet at `sites/pr-<N>.caddyfile` and reloads Caddy
- **WHEN** a PR is closed
- **THEN** the workflow removes the snippet and reloads Caddy
- **AND** standard automatic HTTPS issues / retains the per-host certificate via Let's Encrypt

### Requirement: Docker Compose deployment
The staging environment SHALL be deployed as a separate Docker Compose project alongside production on the same server.

#### Scenario: Staging compose project
- **WHEN** the staging deployment runs
- **THEN** it creates containers in the `trails-staging` project namespace, separate from the `trails-cool` production project

#### Scenario: Shared services
- **WHEN** staging containers need BRouter routing
- **THEN** they connect to the production BRouter container via Docker network, not a duplicate instance
