## 1. Env audit

- [ ] 1.1 Enumerate every env variable read by journal, planner, db, jobs (grep `process.env` + `.env.example`s); classify required/optional/default; fix any default that assumes flagship values (domains, internal IPs)
- [ ] 1.2 Draft the env reference table from the audit

## 2. Example deployment

- [ ] 2.1 Write `infrastructure/examples/docker-compose.selfhost.yml` (journal, planner, postgres+postgis, brouter; healthchecks; named volumes; pinned tags) + `infrastructure/examples/.env.example`
- [ ] 2.2 Verify from scratch on a clean machine/VM: fill env, `up`, create account, plan a route, save to journal
- [ ] 2.3 Document the Docker file-based-secrets variant inline (DB password, app secrets)
- [ ] 2.4 Ensure example compose + `.env.example` contain placeholders and generation commands only (`openssl rand -hex 32`), never working secret values
- [ ] 2.5 Add a boot-time check to the journal: refuse to start when a required secret is missing or a known placeholder, with a log line linking to the self-hosting guide; unit test both paths

## 3. Guide

- [ ] 3.1 Write `docs/self-hosting.md`: prerequisites, quick start, env table, reverse proxy (Caddy example), BRouter segment-region choice, BYO provider credentials (Wahoo redirect URI + HTTPS requirement), upgrade procedure, backup & restore, optional POI index note (per `poi-index` change), scaling/limits
- [ ] 3.1b Backup section: enumerate backup targets (pg_dump + media) vs rebuildable-and-excluded state (BRouter segments, POI index, monitoring data); state the restore-version rule (restore into the producing app version, then upgrade)
- [ ] 3.2 Link from README and `docs/architecture.md`; note the flagship docs (`docs/deployment.md`) are the reference production deployment, not the operator path

## 4. CI

- [ ] 4.1 Add a compose smoke workflow: boot example with generated env, wait healthy, curl journal health + planner page, request a BRouter route with the CI segment; trigger on example/guide/Dockerfile changes + weekly cron
- [ ] 4.2 Add the docs-drift check: every `.env.example` variable must appear in the guide's table

## 5. Verification

- [ ] 5.1 Run `pnpm typecheck && pnpm lint && pnpm test` (unchanged app code paths) and the new smoke workflow on the PR
