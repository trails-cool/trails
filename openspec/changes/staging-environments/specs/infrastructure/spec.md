## MODIFIED Requirements

### Requirement: Caddy reverse proxy routing
Caddy SHALL route requests to staging and PR preview containers via wildcard subdomain matching, in addition to the existing production routing.

#### Scenario: Staging subdomain routing
- **WHEN** a request arrives for `staging.trails.cool`
- **THEN** Caddy proxies it to the staging journal container on port 3100

#### Scenario: Planner staging routing
- **WHEN** a request arrives for `planner.staging.trails.cool`
- **THEN** Caddy proxies it to the staging planner container on port 3101

#### Scenario: PR preview routing
- **WHEN** a request arrives for `pr-123.staging.trails.cool`
- **THEN** Caddy proxies it to the PR 123 journal container on the correct dynamically assigned port

#### Scenario: On-demand TLS for staging subdomains
- **WHEN** a first request arrives for a new staging subdomain
- **THEN** Caddy automatically provisions a TLS certificate via Let's Encrypt
- **AND** a validation endpoint confirms the subdomain is an active staging/preview environment before certificate issuance

### Requirement: Docker Compose deployment
The staging environment SHALL be deployed as a separate Docker Compose project alongside production on the same server.

#### Scenario: Staging compose project
- **WHEN** the staging deployment runs
- **THEN** it creates containers in the `trails-staging` project namespace, separate from the `trails-cool` production project

#### Scenario: Shared services
- **WHEN** staging containers need BRouter routing
- **THEN** they connect to the production BRouter container via Docker network, not a duplicate instance
