# CLAUDE.md

## Project Overview

trails.cool is a federated, self-hostable platform for outdoor enthusiasts with two apps:

- **Planner** (`apps/planner`) — Stateless collaborative route editor. Real-time editing via Yjs, routing via BRouter, no user accounts, sessions are anonymous and ephemeral.
- **Journal** (`apps/journal`) — Federated social platform for routes and activities. User accounts, ActivityPub federation via Fedify, PostgreSQL + PostGIS.

Full architecture: `docs/architecture.md`
Philosophy: `docs/philosophy.md`
OpenSpec change: `openspec/changes/phase-1-mvp/`

## Principles

- **Privacy-first**: The Planner collects zero user data. The Journal documents all data collection in a privacy manifest. Never add tracking, analytics, or data collection without updating the manifest.
- **Data ownership**: All user data must be exportable in open formats (GPX, JSON). Never create data lock-in.
- **Simplicity**: Start with the simplest thing that works. Don't add abstractions, config options, or features unless real users need them.
- **Open standards**: Use GPX, ActivityPub, OpenStreetMap, WebFinger. Don't invent proprietary formats.
- **Inclusive language**: Use "host" not "master", "allowlist" not "whitelist", etc.

## Tech Stack

- **Language**: TypeScript (strict mode)
- **Frontend**: React + Tailwind CSS + React Router 7 (Remix stack)
- **Maps**: Leaflet + OpenStreetMap tiles
- **CRDT**: Yjs + y-websocket (Planner only)
- **Federation**: Fedify (Journal only, Phase 2)
- **Database**: PostgreSQL + PostGIS
- **Media storage**: S3-compatible (Garage)
- **Routing engine**: BRouter (Java, runs as separate Docker container)
- **i18n**: react-i18next (English + German)
- **Monorepo**: pnpm workspaces + Turborepo

## Repository Structure

```
apps/
  planner/          — Planner app (React Router 7)
  journal/          — Journal app (React Router 7 + Fedify)
packages/
  types/            — Shared TypeScript interfaces (Route, Activity, Waypoint)
  ui/               — Shared React components (Tailwind)
  map/              — Leaflet map wrappers and tile layer configs
  gpx/              — GPX parsing, generation, validation
  i18n/             — react-i18next config + translations
infrastructure/     — Terraform + Docker Compose
openspec/           — OpenSpec specs and changes
docs/               — Architecture, philosophy, tooling docs
docker/brouter/     — BRouter Docker image
```

## Development Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Start both apps in dev mode
pnpm build            # Build all packages and apps
pnpm typecheck        # Type-check all packages
pnpm lint             # Lint all packages
pnpm test             # Run unit tests (vitest)
pnpm test:watch       # Run unit tests in watch mode
pnpm test:e2e         # Run E2E tests (playwright, requires dev servers)
pnpm test:e2e:ui      # Run E2E tests with Playwright UI
pnpm dev:full         # Start full stack (Docker + DB + BRouter + apps)
pnpm dev:services     # Start Docker services only (PostgreSQL + BRouter)
pnpm db:push          # Push Drizzle schema to local PostgreSQL
pnpm db:studio        # Open Drizzle Studio (DB browser)
```

## Testing Strategy

- **Unit tests** (Vitest + jsdom): For packages, components, utilities, and app logic.
  Place test files next to source: `foo.ts` → `foo.test.ts`.
  Uses `@testing-library/react` for component tests.
- **E2E tests** (Playwright): For browser behavior across both apps.
  Tests live in `e2e/` at repo root. Scoped per app via `testMatch` in `playwright.config.ts`.
  Playwright auto-starts dev servers if not already running.

**Important**: Write tests alongside implementation, not as an afterthought. When implementing a package or utility, add a co-located `*.test.ts` file. When implementing a user-facing feature, add or update E2E tests. Run `pnpm test` and `pnpm test:e2e` before committing.

## Code Conventions

- **Route registration**: Both apps use explicit `routes.ts` (not file-based routing). When adding a new route file, you **must** add it to `apps/*/app/routes.ts` or it won't be compiled into the build.
- All user-facing strings must use i18n (`useTranslation()` hook, never hardcode strings)
- Use `@trails-cool/types` for shared interfaces — don't duplicate type definitions
- Map components go in `@trails-cool/map`, not in individual apps
- GPX parsing/generation goes in `@trails-cool/gpx`
- Database schemas: `planner.*` for Planner data, `journal.*` for Journal data
- Route geometry must be stored as PostGIS LineString (extracted from GPX on save)

## Key Architecture Decisions

- **Planner is stateless**: No user accounts, no persistent user data. Sessions are anonymous.
- **Journal is the source of truth**: Routes live on the owner's Journal instance.
- **Routing host pattern**: One client per Planner session talks to BRouter (elected via Yjs awareness).
- **JWT callbacks**: Planner saves back to Journal via scoped JWT tokens in callback URLs.
- **Sequential versioning**: Route versions are v1, v2, v3. Yjs state vectors enable conflict-free merging.
- **Single domain**: Each instance uses one domain for both web UI and ActivityPub handles.
- **Simple permissions**: View + Edit only. No fine-grained permissions.

## Git Workflow

**All changes go through pull requests.** Do not push directly to main.

### Before opening a PR
1. Run `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e` — all must pass
2. Check for open PRs: `gh pr list` — avoid conflicts with in-flight work
3. Pull latest main: `git pull origin main --rebase`

### Opening a PR
- Create a feature branch: `git checkout -b <descriptive-name>`
- Keep PRs focused — one logical change per PR
- Use the merge queue to auto-merge when CI passes:
  ```bash
  gh pr create --title "..." --body "..."
  gh pr merge --merge --auto
  ```

### Stacking PRs (for fast local iteration)
When working on sequential tasks, stack branches locally:
```
main → feature-a → feature-b → feature-c
```
- Each branch gets its own PR
- Set the base branch correctly: `gh pr create --base feature-a`
- When feature-a merges, rebase feature-b onto main
- This keeps you unblocked while PRs are in CI

### Important: Do not push to a branch after its PR merges via merge queue
Once a PR enters the merge queue it will merge as soon as CI passes. If you
push additional commits to the branch after that, those commits are orphaned
— they won't be on main. Always check `gh pr view <number> --json state`
before pushing to an existing PR branch.

### After merging
- Update main: `git checkout main && git pull`
- Delete merged branches: `git branch -d <branch>`
- Check if stacked PRs need rebasing

### Emergency override
Admins can bypass the PR workflow when necessary (e.g., CI is broken and needs a hotfix). Document the reason in the commit message.

## Deployment

Three separate CD workflows triggered by path:

| Workflow | Triggers on | Deploys | Target |
|----------|-------------|---------|--------|
| `cd-apps.yml` | `apps/`, `packages/`, `pnpm-lock.yaml` | journal, planner | flagship (`root@trails.cool`) |
| `cd-infra.yml` | `infrastructure/` (except `brouter-host/**`) | caddy, postgres, prometheus, loki, grafana, exporters | flagship (`root@trails.cool`) |
| `cd-brouter.yml` | `docker/brouter/`, `infrastructure/brouter-host/**` | brouter + caddy sidecar | dedicated (`trails@ullrich.is:2232`) |

### Hosts

trails.cool runs on two Hetzner boxes in the same Falkenstein datacenter:

- **Flagship** — Hetzner Cloud `cx23`, public IP + vSwitch IP `10.0.0.2`. Runs Journal, Planner, Postgres, Caddy, Prometheus, Loki, Grafana.
- **BRouter host** — Hetzner Dedicated `ullrich.is`, public IP `176.9.150.227` + vSwitch IP `10.0.1.10`. Shared self-hosted box; trails.cool owns only a non-root `trails` user with docker-group rights, scoped to `~trails/brouter/`. SSH is on port **2232**.

The two hosts are bridged via Hetzner vSwitch #80672 (VLAN 4000). Planner → BRouter traffic crosses it; BRouter → Loki traffic (for log shipping) crosses it back.

### Secrets
All secrets are SOPS-encrypted: `infrastructure/secrets.app.env` (apps + BRouter shared token), `infrastructure/secrets.infra.env` (flagship infra only). Edit with `sops infrastructure/secrets.app.env`. GitHub Actions secrets: `AGE_SECRET_KEY`, `DEPLOY_HOST` / `DEPLOY_SSH_KEY` (flagship), `BROUTER_DEPLOY_HOST` / `BROUTER_DEPLOY_SSH_KEY` / `BROUTER_DEPLOY_SSH_PORT` (dedicated).

### Full restart
To restart **all** containers on the flagship (not just the ones a workflow normally touches):
```bash
gh workflow run cd-infra.yml -f restart_all=true
```

### Server access
```bash
# Flagship — root, standard port, deploy key
ssh -i ~/.ssh/trails-cool-deploy root@trails.cool

# BRouter host — trails user, non-standard port, different deploy key
ssh -i ~/.ssh/trails-brouter-deploy -p 2232 trails@ullrich.is
```

### Grafana
`https://grafana.internal.trails.cool` — GitHub OAuth (trails-cool org)

## OpenSpec Workflow

Specs live in `openspec/`. Use these slash commands:

- `/opsx:propose` — Create a new change with proposal, design, specs, and tasks
- `/opsx:apply` — Implement tasks from an existing change
- `/opsx:explore` — Think through ideas before proposing
- `/opsx:archive` — Archive a completed change
