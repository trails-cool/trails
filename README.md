# trails.cool

Collaborative route planning and federated activity sharing for outdoor
enthusiasts.

**Planner** — Plan routes together in real-time. Share a link, invite friends,
edit waypoints collaboratively. Powered by [BRouter](https://github.com/abrensch/brouter)
for intelligent routing with elevation awareness.

**Journal** — Track your adventures. Import activities from Garmin, Strava, or
Wahoo. Share routes and rides with friends. Self-host your own instance and
federate with others via ActivityPub.

## Status

Early development. See the [architecture plan](docs/architecture.md) and
[project philosophy](docs/philosophy.md).

## Project Structure

This is a TypeScript monorepo using pnpm workspaces and Turborepo.

```
apps/
  planner/        Collaborative route editor (React Router 7 + Yjs + Leaflet)
  journal/        Activity social platform  (React Router 7 + Fedify + PostGIS)

packages/
  types/          Shared TypeScript interfaces
  ui/             Shared React components (Tailwind)
  map/            Leaflet map wrappers
  gpx/            GPX parsing and generation
  i18n/           Internationalization (English + German)
```

## Getting Started

Prerequisites: Node.js 20+, pnpm, Docker

```bash
# Clone
git clone https://github.com/trails-cool/trails.git
cd trails

# Install dependencies
pnpm install

# Start development (apps only, no database or routing)
pnpm dev

# Start full stack (PostgreSQL + BRouter + apps)
pnpm dev:full
```

### Full Local Dev Setup

`pnpm dev:full` starts everything needed to test the Planner end-to-end:

1. **PostgreSQL + PostGIS** on port 5432 (via Docker)
2. **BRouter** routing engine on port 17777 (via Docker)
3. **Database schema** pushed automatically via Drizzle
4. **BRouter segment** downloaded for Berlin area (~124MB, cached)
5. **Journal** on http://localhost:3000
6. **Planner** on http://localhost:3001

Other useful commands:
```bash
pnpm dev:services     # Start Docker services only (DB + BRouter)
pnpm db:push          # Push database schema changes
pnpm db:studio        # Open Drizzle Studio (DB browser)
```

## Development Tools

This project uses AI-assisted, spec-driven development. See
[docs/tooling.md](docs/tooling.md) for details.

| Tool | Purpose |
|------|---------|
| [cmux](https://cmux.dev) | Native macOS terminal for running multiple AI coding sessions |
| [Claude Code](https://claude.ai/claude-code) | AI coding assistant |
| [GitHub Copilot](https://github.com/features/copilot) | AI coding assistant |
| [Crit](https://github.com/tomasz-tomczyk/crit) | Browser-based inline code review |
| [OpenSpec](https://openspec.dev) | Spec-driven development workflow |

## Self-Hosting

The Journal is designed to be self-hosted. A single Docker Compose file gets
you running:

```bash
curl -O https://raw.githubusercontent.com/trails-cool/trails/main/infrastructure/docker-compose.yml
docker compose up -d
```

See [docs/architecture.md](docs/architecture.md) for details on self-hosting
configuration.

## Philosophy

- **Privacy by design** — The Planner collects zero user data
- **Data ownership** — Export everything, self-host, no lock-in
- **Open source** — MIT licensed, built on open standards
- **Simplicity** — Start simple, add complexity only when needed

Read more: [docs/philosophy.md](docs/philosophy.md)

## Contributing

Human contributions are welcome! This project is built with AI-assisted
development (Claude Code + OpenSpec), but we value human judgment, design taste,
and community input.

## License

MIT
