## MODIFIED Requirements

### Requirement: BRouter segment management
The infrastructure SHALL support downloading and updating planet-wide RD5 segments from brouter.de to the dedicated BRouter host. Segment files SHALL live under `~trails/brouter/segments/` on the dedicated host and SHALL be owned by the `trails` user.

#### Scenario: Download segments
- **WHEN** the segment download script runs on the dedicated host as the `trails` user
- **THEN** all planet-wide RD5 files referenced by the tile list are downloaded to `~trails/brouter/segments/`, skipping files that already exist

#### Scenario: Segment update
- **WHEN** an operator re-runs the segment download script
- **THEN** outdated or missing RD5 files are re-fetched from brouter.de and the BRouter container is restarted

### Requirement: CI/CD pipeline
GitHub Actions SHALL use separate workflows for app deployment, infrastructure deployment, and BRouter deployment, with secrets decrypted from a SOPS-encrypted file.

#### Scenario: App deployment
- **WHEN** code changes are pushed to main in apps/ or packages/
- **THEN** the cd-apps workflow builds Docker images, pushes to ghcr.io, and deploys app containers to the flagship host

#### Scenario: Infrastructure deployment
- **WHEN** changes are pushed to main in infrastructure/
- **THEN** the cd-infra workflow copies configs and restarts infrastructure services on the flagship host without rebuilding app images and without touching the BRouter host

#### Scenario: BRouter deployment
- **WHEN** changes are pushed to main in docker/brouter/ or the BRouter host compose config
- **THEN** the cd-brouter workflow SSHes as the `trails` user into the dedicated BRouter host using `BROUTER_DEPLOY_HOST` / `BROUTER_DEPLOY_SSH_KEY` and runs `docker compose up -d` in `~trails/brouter/`

#### Scenario: Secret decryption at deploy time
- **WHEN** any CD workflow runs
- **THEN** the SOPS-encrypted secrets file is decrypted and provided to docker-compose as an env file

#### Scenario: Gitleaks scan
- **WHEN** a PR is opened
- **THEN** gitleaks scans for committed secrets

#### Scenario: Dependency audit
- **WHEN** CI runs
- **THEN** pnpm audit checks for high/critical vulnerabilities

## ADDED Requirements

### Requirement: Private network between flagship and BRouter hosts
The flagship host and the dedicated BRouter host SHALL be joined on a Hetzner vSwitch in the same datacenter. All traffic between Planner and BRouter SHALL traverse this private network.

#### Scenario: vSwitch reachability
- **WHEN** the flagship host issues a request to the BRouter host's vSwitch IP on the BRouter service port with a valid `X-BRouter-Auth` header
- **THEN** the request succeeds over the private network without traversing the public internet

#### Scenario: No public BRouter exposure
- **WHEN** Hetzner Cloud firewall rules or equivalent host firewall rules are inspected
- **THEN** no rule allows inbound traffic to the BRouter service port from any public IP

### Requirement: Non-root deploy user on the BRouter host
The BRouter host SHALL be administered by the trails.cool project through a non-root `trails` user that is a member of the `docker` group. The CD workflow SHALL NOT require sudo or root SSH access on this host.

#### Scenario: Deploy with trails user
- **WHEN** the cd-brouter workflow connects to the BRouter host
- **THEN** it authenticates as `trails` and successfully runs `docker compose` commands without invoking sudo

#### Scenario: Scoped ownership
- **WHEN** files are created by the deploy or segment-download scripts
- **THEN** they live under `~trails/brouter/` and are owned by `trails:trails`
