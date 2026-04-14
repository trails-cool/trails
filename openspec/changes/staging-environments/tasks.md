## 1. DNS & TLS Setup

- [ ] 1.1 Add wildcard DNS record `*.staging.trails.cool` pointing to the Hetzner server IP
- [ ] 1.2 Add `staging.trails.cool` and `planner.staging.trails.cool` DNS A records

## 2. Docker Compose Staging Configuration

- [ ] 2.1 Create `infrastructure/docker-compose.staging.yml` with staging journal (port 3100), planner (port 3101), memory limits (256MB), and `trails_staging` database URL
- [ ] 2.2 Create `infrastructure/staging.env.template` documenting required staging environment variables (DOMAIN, DATABASE_URL, JWT_SECRET, SESSION_SECRET)
- [ ] 2.3 Add a shared Docker network (`trails-shared`) to production `docker-compose.yml` so staging can reach BRouter and PostgreSQL
- [ ] 2.4 Verify staging containers start with `docker compose -f docker-compose.staging.yml -p trails-staging up -d` on the server

## 3. Caddy Wildcard Routing

- [ ] 3.1 Add `staging.trails.cool` site block proxying to journal on port 3100
- [ ] 3.2 Add `planner.staging.trails.cool` site block proxying to planner on port 3101
- [ ] 3.3 Add `*.staging.trails.cool` wildcard site block with on-demand TLS for PR previews — extract PR number from subdomain, proxy to `localhost:3200 + (PR * 2)`
- [ ] 3.4 Create a TLS validation endpoint (small script or Caddy matcher) that checks if the requested subdomain corresponds to a running container
- [ ] 3.5 Reload Caddy and verify staging routes work with `curl -sf https://staging.trails.cool/api/health`

## 4. GitHub Actions Workflow

- [ ] 4.1 Create `.github/workflows/cd-staging.yml` triggered on push to main (paths: `apps/`, `packages/`) and on PR open/synchronize/close (same paths)
- [ ] 4.2 Implement the **staging deploy** job: build images, SSH to server, `docker compose -f docker-compose.staging.yml -p trails-staging pull && up -d`, run Drizzle push against `trails_staging`
- [ ] 4.3 Implement the **PR preview deploy** job: compute ports from PR number, create `trails_pr_<number>` database if not exists, build images tagged with PR number, deploy containers, post preview URL as PR comment
- [ ] 4.4 Implement the **PR preview teardown** job: stop and remove PR containers, drop `trails_pr_<number>` database, delete PR comment
- [ ] 4.5 Add the concurrent preview limit check: if >3 active previews, tear down the oldest before deploying a new one

## 5. Cleanup & Safety

- [ ] 5.1 Create a scheduled cleanup job (weekly cron in GitHub Actions or pg-boss on the server) that lists running `trails-pr-*` containers, checks PR status via `gh pr view`, and tears down orphans
- [ ] 5.2 Add memory limits (`deploy.resources.limits.memory: 256m`) to staging containers in the compose override
- [ ] 5.3 Test full lifecycle: open a test PR → verify preview deploys → push a commit → verify preview updates → close PR → verify teardown

## 6. Documentation

- [ ] 6.1 Add a "Staging & Previews" section to CLAUDE.md documenting the staging URL, PR preview URL pattern, port scheme, and how to debug staging issues
- [ ] 6.2 Update the Deployment table in CLAUDE.md with the new `cd-staging.yml` workflow
