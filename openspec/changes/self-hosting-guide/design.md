## Context

The repo's deployment story is flagship-shaped: `infrastructure/docker-compose.yml` assumes SOPS-encrypted env files, Caddy with production domains, the monitoring stack, and the two-host BRouter topology. `docs/deployment.md` and `docs/server-hardening.md` document *that* deployment. The env-variable surface of the two apps is discoverable only by reading `apps/*/.env.example` (journal) and code. Endurain's operator experience (three compose variants, exhaustive env table in `docs/getting-started/advanced-started.md`, Caddy/NPM recipes, secrets variant) is the reference.

The `poi-index` change (proposed) adds an optional data pipeline with an explicit self-hoster story ("works with empty POI table; regional extract configurable") — this guide is where that story gets told.

## Goals / Non-Goals

**Goals:**
- A competent operator goes from `git clone` to a working instance (journal + planner + routing) in under an hour with only the guide.
- The env contract is documented and CI-guaranteed not to rot.
- Flagship deployment remains untouched and separate.

**Non-Goals:**
- Kubernetes, Ansible, managed cloud recipes; automated backups; federation moderation/ops guides; one-click installers (Proxmox scripts etc. — community territory).

## Decisions

### 1. A separate example compose, not a parametrized flagship compose

`infrastructure/examples/docker-compose.selfhost.yml` is written for operators: 4 services (journal, planner, postgres+postgis, brouter), one host, plain `.env`, named volumes, healthchecks, pinned image tags, no monitoring. Rationale: making the flagship compose serve both audiences couples every production change to operator UX; a small example file with a CI boot test is cheaper to keep honest than a matrix of overrides.

### 2. The env table is the contract

`docs/self-hosting.md` gets a single table: variable, required/optional, default, description — sourced by auditing `apps/journal/.env.example`, `apps/planner` env reads, and `packages/db`/`jobs` config. Writing it doubles as an audit: any variable whose default assumes flagship values (domains, vSwitch IPs) gets a sane default or a documented requirement. BRouter segment coverage (`download-segments.sh` region choice) is documented as the operator's first decision.

### 3. Secrets: plain `.env` primary, Docker secrets documented, no defaults ever

Small operators get `.env` (with a "chmod 600, not in git" note); the guide shows the Docker file-based-secrets variant for the two values that matter most (DB password, app secret keys) without shipping a third compose file. SOPS stays flagship-only.

Two rules adopted from the wanderer review (`docs/inspirations.md` — they ship real default keys in their committed compose, and we won't): the example compose and `.env.example` contain **placeholders + generation commands only** (`openssl rand -hex 32`), never working values; and the journal gains a **boot-time hard failure** when a required secret is missing or still a placeholder — refusing to start with a log line linking to the guide beats running silently insecure. (The boot check is a small app change carried by this change.)

### 3b. Backup guidance distinguishes real state from rebuildable state

The backup section names exactly what must be backed up (PostgreSQL dump + the media store) and what is deliberately excluded because it's rebuildable (BRouter segments — re-downloaded; the POI index — re-imported per `poi-index`; Prometheus/Loki data — observability history, operator's choice). wanderer documents the same rebuildable-cache principle for its search index. The restore procedure states the version rule explicitly: restore a dump into the **same app version that produced it**, then upgrade — schema migrations run forward on boot, not backward (wanderer's restore-only-within-minor-version caveat, made into guidance instead of a surprise).

### 4. CI smoke test keeps the example honest

A workflow job (PR-triggered on `infrastructure/examples/**`, `docs/self-hosting.md`, app Dockerfiles; plus weekly cron) boots the example compose with generated env, waits for health, asserts journal health endpoint + planner page + a BRouter route with the CI segment. Reuses the existing journal-image smoke-test pattern (#556).

### 5. BYO provider credentials

Connected services (Wahoo now; Garmin/COROS later) require per-instance developer apps. The guide documents: where to register, which redirect URI to configure (`https://<domain>/api/sync/connect/<provider>`), which env vars hold the credentials, and that HTTPS is required by providers. This also becomes the canonical answer for staging/preview questions.

## Risks / Trade-offs

- [Example drifts from real app requirements] → the CI boot test is the mitigation; env-table drift is caught by the same audit test where feasible (fail if `.env.example` variables are undocumented).
- [Two compose files to maintain] → deliberate; the example is small and CI-covered.
- [Operators run without monitoring/backups] → backup section is prominent and prescriptive (nightly `pg_dump` + media volume copy); monitoring is explicitly optional with a pointer to the flagship stack as reference.

## Migration Plan

Docs + example + CI only; no production impact. Rollback = revert.

## Open Questions

- None blocking. Whether to publish prebuilt images to a public registry (operators currently build from source or reuse the CI images) is a distribution question to settle during implementation — the guide documents whichever is true at merge time.
