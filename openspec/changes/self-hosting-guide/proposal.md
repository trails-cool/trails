## Why

trails.cool's identity is "federated, self-hostable" — but the repo only documents the flagship deployment (SOPS-encrypted secrets, two-host topology, full monitoring stack). A third party wanting to run an instance has no entry point: no minimal compose file, no environment-variable reference, no backup or upgrade guidance. Endurain (reviewed 2026-07-06) shows the bar for a self-hosted fitness app: three compose variants, a ~45-variable documented env table, reverse-proxy recipes, and Docker-secrets support. Federation is only real if other people can actually stand up instances.

## What Changes

- New **`docs/self-hosting.md`**: prerequisites, quick start, the environment-variable reference table (every variable with default / required / description), reverse-proxy guidance (Caddy example), upgrade procedure (image tags + drizzle migrations), backup & restore (Postgres dump + media store + what *not* to back up), and scaling notes.
- New **minimal operator compose** at `infrastructure/examples/docker-compose.selfhost.yml`: journal + planner + PostgreSQL/PostGIS + BRouter, plain `.env` file (no SOPS), single host, no monitoring stack — with an accompanying `.env.example` documenting the minimal variable set.
- A **secrets variant** documented inline (Docker file-based secrets for DB password and app keys), following Endurain's pattern.
- **BYO provider credentials** documented: how a self-hosted instance registers its own Wahoo (and later Garmin/COROS) developer app and configures redirect URIs — the connected-services features are per-instance, not flagship-only.
- CI smoke check: the example compose must boot and pass health checks so it can't rot (extends the existing journal image smoke-test approach).
- Not in scope: Kubernetes/Helm, managed-DB recipes, automated backup tooling, and multi-instance federation operations guides (allowlists/moderation — future).

## Capabilities

### New Capabilities
- `self-hosting`: The supported third-party deployment surface — minimal compose, documented env contract, upgrade/backup procedures, and the CI guarantee that the example deployment boots.

### Modified Capabilities

<!-- none — infrastructure spec describes the flagship; the operator example is a parallel, additive surface -->

## Impact

- `docs/self-hosting.md` (new), linked from README and `docs/architecture.md`.
- `infrastructure/examples/docker-compose.selfhost.yml` + `.env.example` (new).
- `.github/workflows`: compose smoke job (boot, wait healthy, hit health endpoints, planner loads).
- Possible small app fixes surfaced by the exercise (env defaults that assume flagship values) — folded in as found.
