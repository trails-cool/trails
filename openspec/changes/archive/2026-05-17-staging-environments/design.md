## Context

trails.cool runs on a single Hetzner cx23 server (2 vCPU, 4 GB RAM) with Docker Compose. Production uses Caddy as reverse proxy, PostgreSQL + PostGIS, and three CD workflows (apps, infra, brouter). There is currently no staging or preview environment — changes go straight to production after CI passes.

The server has headroom for lightweight additional containers. Caddy handles automatic TLS via Let's Encrypt and supports on-demand TLS for wildcard subdomains.

## Goals / Non-Goals

**Goals:**
- Persistent staging instance at `staging.trails.cool` that auto-deploys from main
- Ephemeral PR preview environments at `pr-<number>.staging.trails.cool` that spin up on PR open and tear down on PR close
- Full database isolation between production, staging, and each PR preview
- Minimal resource overhead — share BRouter and infrastructure services (Prometheus, Grafana, Loki) with production
- PR previews accessible to anyone with the URL (no auth required for the preview itself)

**Non-Goals:**
- Staging federation (ActivityPub) — staging instances don't need to federate
- Staging email delivery — use log transport or discard
- Load testing or performance parity with production
- PR previews for infrastructure-only changes
- Separate server provisioning

## Decisions

### 1. Shared server, separate Docker Compose projects
**Choice**: Run staging as a separate Docker Compose project (`trails-staging`) on the same server, sharing the host network and BRouter/monitoring containers with production.
**Rationale**: A separate Compose project gives clean namespace isolation (container names, volumes) without a second server. Sharing BRouter and monitoring avoids duplicating heavy services.
**Alternative considered**: Docker Compose profiles — simpler but risks accidental cross-contamination between production and staging in the same project.

### 2. Per-PR Caddyfile snippets with reload
**Choice**: The main Caddyfile uses `import sites/*.caddyfile`. The cd-staging workflow writes a snippet per PR (e.g. `sites/pr-123.caddyfile`) on PR open and removes it on PR close, then reloads Caddy in-place. Standard automatic HTTPS issues a per-host cert.
**Rationale**: Caddy can't compute upstream ports from a regex capture (the spec's `3200 + 2N` formula), so a wildcard block would need a sidecar router service. A graceful Caddy reload is fast and idempotent, and the existing cd-apps workflow already reloads Caddy on every deploy — extending that pattern is simpler than adding a new service.
**Alternatives considered**: (a) Wildcard `*.staging.trails.cool` block with on-demand TLS plus a small Node router that handles Caddy's `ask` check and wildcard host→port proxying — more moving parts. (b) DNS-challenge wildcard certificate — requires DNS API credentials in Caddy and more complex setup.

### 3. Per-PR databases in shared PostgreSQL
**Choice**: PR previews use per-PR databases (`trails_pr_123`) in the production PostgreSQL instance. Staging uses `trails_staging`. Created by the workflow, dropped on PR close.
**Rationale**: PostgreSQL handles multiple databases efficiently. No need for a separate PostgreSQL container per preview. Drizzle Kit `push` handles schema setup.
**Alternative considered**: Separate PostgreSQL container per preview — full isolation but heavy resource cost.

### 4. Port allocation scheme
**Choice**: Staging journal on port 3100, planner on 3101. PR previews on ports `3200 + (PR number * 2)` for journal and `3201 + (PR number * 2)` for planner.
**Rationale**: Deterministic port mapping from PR number. Production stays on 3000/3001. Port collisions are practically impossible (would need 50+ concurrent PRs).
**Alternative considered**: Docker DNS-based routing — would require a custom network resolver setup.

### 5. GitHub Actions workflow
**Choice**: Single `cd-staging.yml` workflow handling both staging deploys (on main push) and PR preview lifecycle (on PR open/sync/close).
**Rationale**: Keeps staging logic in one place. Uses `github.event.action` to distinguish between deploy, update, and teardown.

## Risks / Trade-offs

- **Resource contention**: Staging and PR previews share CPU/memory with production. → Mitigation: Limit concurrent PR previews (e.g., max 3). Add memory limits to staging containers. Monitor via existing Grafana/cAdvisor.
- **Port exhaustion**: Many concurrent PRs could exhaust the port range. → Mitigation: Port scheme supports ~50 concurrent PRs, far more than needed. Cleanup job runs on PR close.
- **Database isolation**: PR databases share the same PostgreSQL instance as production. → Mitigation: Use separate database names and credentials. PR databases are disposable — created and dropped by the workflow.
- **Stale PR previews**: If a workflow fails to clean up, containers and databases linger. → Mitigation: Add a scheduled cleanup job that checks for closed PRs and removes their resources.
- **TLS rate limits**: Let's Encrypt has rate limits (50 certs/week per registered domain). → Mitigation: `*.staging.trails.cool` previews are subdomains of a single domain, counting as one. On-demand TLS with validation prevents abuse.
