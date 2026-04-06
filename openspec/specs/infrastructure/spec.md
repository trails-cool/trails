## Purpose

Server provisioning on Hetzner, Docker Compose deployment, CI/CD pipelines, database and BRouter management, TLS, Sentry, Grafana, and monitoring stack for the flagship instance.

## Requirements

### Requirement: Terraform Hetzner provisioning
Infrastructure SHALL be provisioned on Hetzner Cloud using Terraform with the Hetzner provider.

#### Scenario: Provision server
- **WHEN** `terraform apply` is run
- **THEN** a Hetzner cx23 server (2 vCPU, 4 GB RAM, 40 GB SSD) is created with Docker installed

### Requirement: Docker Compose deployment
All services SHALL be deployed via Docker Compose on the Hetzner server.

#### Scenario: Start all services
- **WHEN** `docker compose up -d` is run on the server
- **THEN** the Journal, Planner, BRouter, and PostgreSQL containers start and are reachable

### Requirement: Service configuration
Each service SHALL be configured via environment variables defined in Docker Compose, with security best practices including non-root execution and security headers.

#### Scenario: Journal configuration
- **WHEN** the Journal container starts
- **THEN** it reads DOMAIN, DATABASE_URL, PLANNER_URL, JWT_SECRET, SESSION_SECRET, and WAHOO_* credentials from environment variables

#### Scenario: Planner configuration
- **WHEN** the Planner container starts
- **THEN** it reads BROUTER_URL and DATABASE_URL from environment variables

#### Scenario: Caddy security headers
- **WHEN** Caddy proxies a request
- **THEN** it adds HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, and Permissions-Policy headers

#### Scenario: Caddy scanner blocking
- **WHEN** a request matches known scanner paths (.env, .git, wp-config, etc.)
- **THEN** Caddy returns 403 without forwarding to the application

### Requirement: PostgreSQL with PostGIS
The database SHALL be PostgreSQL with the PostGIS extension for spatial queries.

#### Scenario: PostGIS available
- **WHEN** the PostgreSQL container starts
- **THEN** the PostGIS extension is available and can be enabled with `CREATE EXTENSION postgis`

### Requirement: BRouter segment management
The infrastructure SHALL support downloading and updating Germany RD5 segments from brouter.de.

#### Scenario: Download segments
- **WHEN** the segment download script is run
- **THEN** Germany RD5 files (E5_N45, E5_N50, E10_N45, E10_N50) are downloaded to the segments volume

#### Scenario: Weekly segment update
- **WHEN** the weekly cron job runs
- **THEN** RD5 segments are updated from brouter.de and the BRouter container is restarted

### Requirement: CI/CD pipeline
GitHub Actions SHALL use separate workflows for app deployment and infrastructure deployment, with secrets decrypted from a SOPS-encrypted file.

#### Scenario: App deployment
- **WHEN** code changes are pushed to main in apps/ or packages/
- **THEN** the cd-apps workflow builds Docker images, pushes to ghcr.io, and deploys app containers

#### Scenario: Infrastructure deployment
- **WHEN** changes are pushed to main in infrastructure/
- **THEN** the cd-infra workflow copies configs and restarts infrastructure services without rebuilding app images

#### Scenario: Secret decryption at deploy time
- **WHEN** either CD workflow runs
- **THEN** the SOPS-encrypted secrets file is decrypted and provided to docker-compose as an env file

#### Scenario: Gitleaks scan
- **WHEN** a PR is opened
- **THEN** gitleaks scans for committed secrets

#### Scenario: Dependency audit
- **WHEN** CI runs
- **THEN** pnpm audit checks for high/critical vulnerabilities

### Requirement: Backup strategy
The infrastructure SHALL include daily backups of the PostgreSQL database.

#### Scenario: Daily backup
- **WHEN** the daily backup cron runs
- **THEN** a PostgreSQL dump is uploaded to the Hetzner Storage Box

### Requirement: Domain and TLS
The infrastructure SHALL configure DNS and TLS for trails.cool and planner.trails.cool.

#### Scenario: HTTPS access
- **WHEN** a user navigates to https://trails.cool
- **THEN** the connection is secured with a valid TLS certificate

### Requirement: Sentry error tracking
The system SHALL enrich Sentry events with user and session context, use route-aware tracing, and prevent source maps from being served to clients.

#### Scenario: Journal error includes user context
- **WHEN** an authenticated Journal user triggers an error
- **THEN** the Sentry event SHALL include the user's ID and username

#### Scenario: Journal error without user context
- **WHEN** an unauthenticated visitor triggers an error
- **THEN** the Sentry event SHALL have no user context (Sentry.setUser(null))

#### Scenario: Planner error includes session ID
- **WHEN** an error occurs during a Planner session
- **THEN** the Sentry event SHALL include a `session_id` tag with the active session ID

#### Scenario: Route-level performance traces
- **WHEN** a user navigates between routes in either app
- **THEN** Sentry SHALL create a transaction span named after the route pattern (e.g., `/routes/:id`)

#### Scenario: Source maps not served to clients
- **WHEN** a client requests a `.map` file from the production server
- **THEN** the server SHALL return 404 (source maps are uploaded to Sentry during build, not shipped in the bundle)

### Requirement: Grafana authentication
Grafana SHALL authenticate users via GitHub OAuth, restricted to the trails-cool GitHub organization.

#### Scenario: GitHub OAuth login
- **WHEN** a user navigates to grafana.internal.trails.cool
- **THEN** they are redirected to GitHub for authentication and granted access if they are a member of the trails-cool organization

#### Scenario: No password-based login
- **WHEN** Grafana is deployed
- **THEN** the login form is disabled and only GitHub OAuth is available

### Requirement: Docker Compose deployment
All services SHALL be deployed via Docker Compose, including Grafana, Prometheus, and Loki for the flagship instance.

#### Scenario: Monitoring stack starts
- **WHEN** `docker compose up -d` is run
- **THEN** Grafana, Prometheus, Loki, Promtail, postgres-exporter, node-exporter, and cAdvisor containers start alongside the application containers

### Requirement: Metrics collection
Prometheus SHALL scrape metrics from all application and infrastructure services.

#### Scenario: Exporter targets
- **WHEN** Prometheus is running
- **THEN** it scrapes metrics from journal (/api/metrics), planner (/metrics), postgres-exporter, node-exporter, cAdvisor, and Caddy (:2019)

#### Scenario: pg_stat_statements
- **WHEN** postgres-exporter scrapes PostgreSQL
- **THEN** slow query metrics from pg_stat_statements are exposed with query text via a custom queries config

### Requirement: Container log shipping
Promtail SHALL scrape all Docker container logs and push them to Loki for querying in Grafana.

#### Scenario: Logs visible in Grafana
- **WHEN** a container writes to stdout or stderr
- **THEN** the log line is available in Grafana Explore via Loki with container name labels

### Requirement: Caddy access logging
Caddy SHALL emit structured JSON access logs for all requests.

#### Scenario: Access log emitted
- **WHEN** any HTTP request passes through Caddy
- **THEN** a JSON log line with remote IP, method, path, status, and duration is written to stdout
