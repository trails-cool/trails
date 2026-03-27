## 1. SOPS + age Setup

- [x] 1.1 Generate age key pair (`age-keygen`), store public key in `.sops.yaml`, private key as `AGE_SECRET_KEY` GitHub secret
- [x] 1.2 Create `.sops.yaml` at repo root with age encryption rule for `secrets.*.env`
- [x] 1.3 Create `infrastructure/secrets.app.env` with app secrets (POSTGRES_PASSWORD, JWT_SECRET, SESSION_SECRET, SMTP_URL, SMTP_FROM, SENTRY_AUTH_TOKEN, DEPLOY_GHCR_TOKEN), encrypt with `sops -e`
- [x] 1.4 Create `infrastructure/secrets.infra.env` with infra secrets (GF_AUTH_GITHUB_CLIENT_ID, GF_AUTH_GITHUB_CLIENT_SECRET), encrypt with `sops -e`
- [ ] 1.5 Remove migrated secrets from GitHub Actions (keep only AGE_SECRET_KEY, DEPLOY_SSH_KEY, DEPLOY_HOST)

## 2. GitHub OAuth for Grafana

- [x] 2.1 Register GitHub OAuth app (callback: grafana.internal.trails.cool/login/github)
- [x] 2.2 Add GF_AUTH_GITHUB_CLIENT_ID and GF_AUTH_GITHUB_CLIENT_SECRET to secrets.env
- [x] 2.3 Update docker-compose.yml: add GitHub OAuth env vars to Grafana, remove GF_SECURITY_ADMIN_USER/PASSWORD
- [x] 2.4 Update Caddyfile: remove basic_auth block for grafana.internal, just reverse_proxy
- [x] 2.5 Remove Caddy GRAFANA_USER/GRAFANA_PASSWORD_HASH env vars from docker-compose.yml

## 3. Split CD Workflows

- [x] 3.1 Create `.github/workflows/cd-apps.yml` — triggered by apps/, packages/, pnpm-lock.yaml changes
- [x] 3.2 Create `.github/workflows/cd-infra.yml` — triggered by infrastructure/ changes
- [x] 3.3 Add sops + age install step to both workflows
- [x] 3.4 cd-apps decrypt step: `sops -d secrets.app.env > .env`, SCP to server
- [x] 3.5 cd-infra decrypt step: merge `secrets.app.env` + `secrets.infra.env` into `.env`, SCP to server
- [x] 3.6 cd-apps: build images, push, SSH deploy (pull, migrate, restart apps)
- [x] 3.7 cd-infra: copy configs, SSH deploy (restart infra services)
- [x] 3.8 Remove old `cd.yml` workflow
- [x] 3.9 Remove GRAFANA_* exports and password reset from deploy script
- [x] 3.10 Both workflows use `docker compose --env-file .env up -d` instead of inline exports

## 4. Verify

- [x] 4.1 Test sops encrypt/decrypt cycle locally
- [ ] 4.2 Test cd-apps deploys only on app changes (not infra)
- [ ] 4.3 Test cd-infra deploys only on infra changes (not apps)
- [ ] 4.4 Test Grafana GitHub OAuth login
- [ ] 4.5 Verify old GitHub secrets can be removed after migration
