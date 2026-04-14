## Why

There is no way to test changes in a production-like environment before merging. The only testing options are local dev (`pnpm dev:full`) or deploying directly to production. This makes it risky to test features that depend on real infrastructure (Caddy TLS, Docker networking, PostgreSQL migrations, OAuth callbacks) and impossible for non-developers (e.g., design reviewers) to preview PRs. A staging environment would catch integration issues earlier and give PR reviewers a live URL to test against.

## What Changes

- Add a **persistent staging instance** (`staging.trails.cool` / `planner.staging.trails.cool`) running on the same Hetzner server as production, using a separate Docker Compose project with its own PostgreSQL database, port range, and Caddy configuration
- Add **ephemeral PR preview environments** that spin up automatically when a PR is opened, serve at `pr-<number>.staging.trails.cool`, and tear down when the PR is merged or closed
- Add a **GitHub Actions workflow** (`cd-staging.yml`) that deploys the staging instance on pushes to main and manages PR preview lifecycle
- Add a **Docker Compose override** (`docker-compose.staging.yml`) for staging-specific configuration (ports, database, domain)
- Add **Caddy wildcard routing** for `*.staging.trails.cool` to dynamically route to the correct preview or staging container
- Add a **cleanup job** to tear down PR preview containers and their databases when PRs close

## Capabilities

### New Capabilities
- `staging-environment`: Persistent staging instance configuration, PR preview lifecycle, Docker Compose staging overrides, Caddy routing, GitHub Actions integration, database isolation, and cleanup

### Modified Capabilities
- `infrastructure`: Caddy gains wildcard subdomain routing for staging; Docker Compose gains staging profiles and a staging-specific override file

## Impact

- **DNS**: Requires a wildcard DNS record `*.staging.trails.cool` pointing to the same server
- **TLS**: Caddy handles automatic TLS for staging subdomains via Let's Encrypt
- **Disk/memory**: Each PR preview runs journal + planner + a shared staging PostgreSQL instance on the production server. Resource usage scales with active PRs.
- **Database**: Staging uses a separate PostgreSQL database (`trails_staging`). PR previews use per-PR databases (`trails_pr_<number>`), created and dropped by the workflow.
- **Secrets**: Staging shares the same SOPS-encrypted secrets as production (same server), with staging-specific overrides for domain and database.
- **GitHub Actions**: New workflow triggered on PR open/sync/close and main push.
