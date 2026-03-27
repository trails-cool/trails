## MODIFIED Requirements

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

### Requirement: Grafana authentication
Grafana SHALL authenticate users via GitHub OAuth, restricted to the trails-cool GitHub organization.

#### Scenario: GitHub OAuth login
- **WHEN** a user navigates to grafana.internal.trails.cool
- **THEN** they are redirected to GitHub for authentication and granted access if they are a member of the trails-cool organization

#### Scenario: No password-based login
- **WHEN** Grafana is deployed
- **THEN** the login form is disabled and only GitHub OAuth is available
