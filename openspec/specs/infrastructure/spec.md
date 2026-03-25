## ADDED Requirements

### Requirement: Terraform Hetzner provisioning
Infrastructure SHALL be provisioned on Hetzner Cloud using Terraform with the Hetzner provider.

#### Scenario: Provision server
- **WHEN** `terraform apply` is run
- **THEN** a Hetzner CX21 server (2 vCPU, 4 GB RAM, 40 GB SSD) is created with Docker installed

### Requirement: Docker Compose deployment
All services SHALL be deployed via Docker Compose on the Hetzner server.

#### Scenario: Start all services
- **WHEN** `docker compose up -d` is run on the server
- **THEN** the Journal, Planner, BRouter, PostgreSQL, and Garage containers start and are reachable

### Requirement: Service configuration
Each service SHALL be configured via environment variables defined in Docker Compose.

#### Scenario: Journal configuration
- **WHEN** the Journal container starts
- **THEN** it reads DOMAIN, DATABASE_URL, PLANNER_URL, S3_ENDPOINT, and S3_BUCKET from environment variables

#### Scenario: Planner configuration
- **WHEN** the Planner container starts
- **THEN** it reads BROUTER_URL and DATABASE_URL from environment variables

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
GitHub Actions SHALL build and deploy both apps on push to main.

#### Scenario: Push triggers deployment
- **WHEN** code is pushed to the main branch
- **THEN** GitHub Actions builds Docker images, pushes to ghcr.io/trails-cool/, and deploys to the Hetzner server

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
