## 1. DNS & TLS Setup

- [x] 1.1 Add wildcard DNS record `*.staging.trails.cool` pointing to the Hetzner server IP
- [x] 1.2 Add `staging.trails.cool` and `planner.staging.trails.cool` DNS A records (planner.staging covered by the wildcard)

## 2. Docker Compose Staging Configuration

- [x] 2.1 Create `infrastructure/docker-compose.staging.yml` with staging journal (port 3100), planner (port 3101), memory limits (256MB), and `trails_staging` database URL
- [x] 2.2 Create `infrastructure/staging.env.template` documenting required staging environment variables (DOMAIN, DATABASE_URL, JWT_SECRET, SESSION_SECRET)
- [x] 2.3 Add a shared Docker network (`trails-shared`) to production `docker-compose.yml` so staging can reach BRouter and PostgreSQL
- [x] 2.4 Verify staging containers start with `docker compose -f docker-compose.staging.yml -p trails-staging up -d` on the server

## 3. Caddy Wildcard Routing

- [x] 3.1 Add `staging.trails.cool` site block proxying to journal on port 3100
- [x] 3.2 Add `planner.staging.trails.cool` site block proxying to planner on port 3101
- [x] 3.3 Add `import sites/*.caddyfile` to the main Caddyfile so per-PR site blocks can be dropped in and picked up on reload
- [x] 3.4 Define the per-PR Caddyfile snippet template the cd-staging workflow writes for each preview (host = `pr-<N>.staging.trails.cool`, upstream = `host.docker.internal:<port>`, port = `3200 + 2N`)
- [x] 3.5 Reload Caddy and verify staging routes work with `curl -sf https://staging.trails.cool/api/health`

## 4. GitHub Actions Workflow

- [x] 4.1 Create `.github/workflows/cd-staging.yml` triggered on push to main (paths: `apps/`, `packages/`) and on PR open/synchronize/close (same paths)
- [x] 4.2 Implement the **staging deploy** job: build images, SSH to server, `docker compose -f docker-compose.staging.yml -p trails-staging pull && up -d`, run Drizzle push against `trails_staging`
- [x] 4.3 Implement the **PR preview deploy** job: compute ports from PR number, create `trails_pr_<number>` database if not exists, build images tagged with PR number, deploy containers, post preview URL as PR comment
- [x] 4.4 Implement the **PR preview teardown** job: stop and remove PR containers, drop `trails_pr_<number>` database, delete PR comment
- [x] 4.5 Add the concurrent preview limit check: if >3 active previews, tear down the oldest before deploying a new one

## 5. Cleanup & Safety

- [x] 5.1 Create a scheduled cleanup job (weekly cron in GitHub Actions or pg-boss on the server) that lists running `trails-pr-*` containers, checks PR status via `gh pr view`, and tears down orphans
- [x] 5.2 Add memory limits (`deploy.resources.limits.memory: 256m`) to staging containers in the compose override
- [x] 5.3 Test full lifecycle: open a test PR → verify preview deploys → push a commit → verify preview updates → close PR → verify teardown

## 6. Documentation

- [x] 6.1 Add a "Staging & Previews" section to CLAUDE.md documenting the staging URL, PR preview URL pattern, port scheme, and how to debug staging issues
- [x] 6.2 Update the Deployment table in CLAUDE.md with the new `cd-staging.yml` workflow
