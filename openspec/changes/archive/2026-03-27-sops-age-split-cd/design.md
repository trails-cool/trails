## Context

The current CD workflow has ~10 GitHub Actions secrets passed via `export`
statements in a deploy script. Some secrets contain `$` characters that get
mangled. Grafana authentication required managing a bcrypt hash, a plaintext
password, and a username across three different systems (Caddy, Grafana, CD).
The single CD workflow rebuilds Docker images even for config-only changes.

## Goals / Non-Goals

**Goals:**
- All secrets in one encrypted file in the repo (SOPS + age)
- Only one GitHub secret needed for decryption (AGE_SECRET_KEY)
- App deploys (Docker build + push) separate from infra deploys (config copy)
- Grafana login via GitHub OAuth (no passwords)
- Remove Caddy basic auth for Grafana

**Non-Goals:**
- Secret rotation automation (manual for now)
- Per-environment secret files (only production)
- Grafana RBAC / team-based access (just org membership check)
- Moving DEPLOY_SSH_KEY or GITHUB_TOKEN into SOPS (these are GitHub-native)

## Decisions

### D1: SOPS + age file-based encryption

Create `.sops.yaml` at the repo root defining age as the encryption method.
Two encrypted secret files, split by deployment scope:

- **`infrastructure/secrets.app.env`** — app secrets needed by journal/planner.
  Used by both cd-apps (production) and future staging deploys.
- **`infrastructure/secrets.infra.env`** — monitoring/Grafana secrets.
  Used only by cd-infra (production). Staging doesn't run Grafana.

```yaml
# .sops.yaml
creation_rules:
  - path_regex: secrets\..*\.env$
    age: <public-key>
```

Workflow:
- **Edit secrets**: `sops infrastructure/secrets.app.env` (decrypts in editor,
  re-encrypts on save)
- **CD decrypts**: Install sops + age, decrypt the relevant file(s) to a temp
  `.env`, pass to `docker compose --env-file`
- **Only one GitHub secret**: `AGE_SECRET_KEY` (the private key)

**secrets.app.env** contents (used by cd-apps + cd-infra):
- POSTGRES_PASSWORD, JWT_SECRET, SESSION_SECRET
- SMTP_URL, SMTP_FROM
- SENTRY_AUTH_TOKEN
- DEPLOY_GHCR_TOKEN

**secrets.infra.env** contents (used by cd-infra only):
- GF_AUTH_GITHUB_CLIENT_ID, GF_AUTH_GITHUB_CLIENT_SECRET

Secrets that stay as GitHub Actions secrets:
- DEPLOY_SSH_KEY (used by SCP/SSH actions, not by docker-compose)
- AGE_SECRET_KEY (chicken-and-egg: can't encrypt the decryption key)
- DEPLOY_HOST (not really secret, but convenient)

### D2: Split CD into two workflows

**cd-apps.yml** — triggered by changes to `apps/`, `packages/`, `pnpm-lock.yaml`:
1. Build and push Docker images (journal, planner, brouter)
2. SSH to server, pull images, run migrations, restart app containers

**cd-infra.yml** — triggered by changes to `infrastructure/`:
1. Copy config files (docker-compose, Caddyfile, Prometheus, Loki, Grafana)
2. SSH to server, decrypt secrets, `docker compose up -d`

Both workflows also trigger on `workflow_dispatch` for manual runs.
Both share the decrypt-secrets step.

### D3: GitHub OAuth for Grafana

Register a GitHub OAuth app at github.com/settings/applications:
- Callback URL: `https://grafana.internal.trails.cool/login/github`
- Homepage: `https://grafana.internal.trails.cool`

Grafana config via environment variables:
```yaml
GF_AUTH_GITHUB_ENABLED: "true"
GF_AUTH_GITHUB_CLIENT_ID: <from-sops>
GF_AUTH_GITHUB_CLIENT_SECRET: <from-sops>
GF_AUTH_GITHUB_ALLOWED_ORGANIZATIONS: trails-cool
GF_AUTH_GITHUB_SCOPES: user:email,read:org
GF_AUTH_DISABLE_LOGIN_FORM: "true"
```

Remove from Caddyfile:
- `basic_auth` block for grafana.internal
- GRAFANA_USER, GRAFANA_PASSWORD, GRAFANA_PASSWORD_HASH env vars

Remove from docker-compose.yml:
- GF_SECURITY_ADMIN_USER, GF_SECURITY_ADMIN_PASSWORD
- Caddy GRAFANA_USER, GRAFANA_PASSWORD_HASH env vars

Remove from CD:
- grafana cli password reset step
- All GRAFANA_* secret exports

### D4: Server-side secret decryption

The CD deploy step:
1. Install sops + age on the runner
2. Decrypt: `SOPS_AGE_KEY=${{ secrets.AGE_SECRET_KEY }} sops -d infrastructure/secrets.env > /tmp/secrets.env`
3. SCP the decrypted `.env` to server as `/opt/trails-cool/.env`
4. `docker compose --env-file .env up -d`
5. Clean up `/tmp/secrets.env` from runner

The server never has the age private key — secrets arrive as a plain `.env`
file via SCP (same security as current `export` approach, but now
version-controlled and auditable).

## Risks / Trade-offs

- **age key loss** → If the AGE_SECRET_KEY is lost, secrets can't be decrypted.
  Mitigate: store a backup of the age key outside GitHub (e.g., password
  manager).
- **Encrypted file merge conflicts** → SOPS encrypted files don't merge well.
  Mitigate: only one person edits secrets at a time (fine for solo/small team).
- **GitHub OAuth requires internet** → If GitHub is down, Grafana login fails.
  Acceptable for a monitoring dashboard.
