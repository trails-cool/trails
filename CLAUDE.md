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
turbo dev             # Start both apps in dev mode
turbo build           # Build all packages and apps
turbo typecheck       # Type-check all packages
turbo lint            # Lint all packages
pnpm test             # Run unit tests (vitest)
pnpm test:watch       # Run unit tests in watch mode
pnpm test:e2e         # Run E2E tests (playwright, requires dev servers)
pnpm test:e2e:ui      # Run E2E tests with Playwright UI
```

## Testing Strategy

- **Unit tests** (Vitest + jsdom): For packages, components, utilities, and app logic.
  Place test files next to source: `foo.ts` → `foo.test.ts`.
  Uses `@testing-library/react` for component tests.
- **E2E tests** (Playwright): For browser behavior across both apps.
  Tests live in `e2e/` at repo root. Scoped per app via `testMatch` in `playwright.config.ts`.
  Playwright auto-starts dev servers if not already running.

## Code Conventions

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

## OpenSpec Workflow

Specs live in `openspec/`. Use these slash commands:

- `/opsx:propose` — Create a new change with proposal, design, specs, and tasks
- `/opsx:apply` — Implement tasks from an existing change
- `/opsx:explore` — Think through ideas before proposing
- `/opsx:archive` — Archive a completed change
