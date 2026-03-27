## Why

Secrets are scattered across GitHub Actions secrets with no version control,
no audit trail, and painful manual management (the Grafana password hash saga).
The CD pipeline is monolithic — changing a Grafana dashboard rebuilds both app
Docker images. And Grafana authentication requires managing bcrypt hashes and
basic auth layers.

## What Changes

- **SOPS + age for secrets**: Encrypt a `.env.production` file in the repo.
  CD decrypts at deploy time with a single age private key stored as one
  GitHub secret. All other secrets move from GitHub Actions secrets into the
  encrypted file — version-controlled, diffable, auditable.
- **Split CD into apps vs infra**: Two workflows triggered by path filters.
  App changes (apps/, packages/) build Docker images and deploy. Infra changes
  (infrastructure/) copy configs and restart services. No unnecessary rebuilds.
- **GitHub OAuth for Grafana**: Replace Caddy basic auth + Grafana login with
  GitHub OAuth. One login, restricted to the trails-cool GitHub org. Remove
  GRAFANA_PASSWORD_HASH, GRAFANA_USER, GRAFANA_PASSWORD secrets entirely.

## Capabilities

### New Capabilities

- `secret-management`: SOPS + age encrypted secrets in the repository with
  CD decryption

### Modified Capabilities

- `infrastructure`: Split CD workflows, GitHub OAuth for Grafana, remove
  Caddy basic auth for Grafana

## Impact

- **Files**: New `.env.production.enc` (encrypted), `.sops.yaml` config,
  split `cd-apps.yml` and `cd-infra.yml` workflows, updated docker-compose.yml
  and Caddyfile
- **Dependencies**: `sops` and `age` CLI tools in CD runner (install step)
- **GitHub secrets**: Reduced from ~10 secrets to 2 (AGE_SECRET_KEY +
  DEPLOY_SSH_KEY). Everything else moves into the encrypted env file.
- **Grafana**: GitHub OAuth app registration needed (Client ID + Secret go
  into the SOPS-encrypted file)
- **Caddy**: Remove basic auth block for grafana.internal, just proxy through
