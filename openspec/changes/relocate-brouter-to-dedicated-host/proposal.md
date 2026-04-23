## Why

BRouter currently runs co-located with the Journal, Planner, PostgreSQL, and the observability stack on a single Hetzner Cloud box (cx23: 2 vCPU / 4 GB RAM / 40 GB SSD). The 40 GB disk and 4 GB RAM budget cap us at a Europe-only segment set; global routing needs ~60–80 GB of RD5 files and a JVM heap that doesn't compete with Postgres and Loki for memory. A larger self-hosted server in the same Hetzner datacenter has 3 TB of RAID storage and 32 GB of RAM available with headroom to spare, and co-locating stays on the private Hetzner network for low latency. Moving BRouter there unlocks global routing without contending for resources on the primary host.

## What Changes

- Run BRouter on a second Hetzner host in the same datacenter, owned by a non-root `trails` user that is a member of the `docker` group (no sudo).
- Expose BRouter only on a private network interface (Hetzner vSwitch) shared with the primary host; no public ingress. The existing host firewall rejects everything else.
- Front the BRouter container with a Caddy sidecar that enforces a shared-secret header (`X-BRouter-Auth: <token>`). The Planner backend adds the header when proxying `/api/route`. Requests without the header are rejected with 403.
- Extend BRouter coverage from the current Europe RD5 set to the full planet (~60–80 GB on disk). The dedicated host's disk accommodates this comfortably.
- Size the BRouter JVM for planet-scale traffic: `-Xmx8g` heap on a host with 32 GB total RAM, leaving generous page cache for segment files.
- **BREAKING** for operators: `cd-brouter.yml` targets a new host/SSH identity (`trails@<brouter-host>`) instead of `root@<main-host>`. The segment-download logic moves with the workflow, and the segment tile list expands to global.
- Update the Planner's `BROUTER_URL` to the new host's private vSwitch address and add `BROUTER_AUTH_TOKEN` as a new SOPS-managed secret. The Planner sends the token on every request.
- Scrape BRouter-specific metrics (cAdvisor filtered to the BRouter container, JVM exporter if available) and tail BRouter container logs from the primary host's Prometheus/Loki over the vSwitch. Do **not** scrape the shared host's `node_exporter` — its other self-hosted workloads are out of scope for trails.cool observability.
- Remove the BRouter service from the primary host's `infrastructure/docker-compose.yml` once cutover is complete; stop shipping BRouter images to the primary via `cd-infra.yml`.
- Document the new host in `CLAUDE.md` and `docs/architecture.md` as a second deployment target.

## Capabilities

### New Capabilities

_None._ This change relocates an existing capability rather than introducing a new user-facing one. All new requirements extend existing specs.

### Modified Capabilities

- `brouter-integration`: deployment target changes from co-located Docker Compose service to a remote host reached over a private network; adds a shared-secret auth requirement on the proxy hop; extends segment coverage from Europe to global.
- `infrastructure`: introduces a second Hetzner host on a vSwitch, a non-root `trails` deploy user, a global segment management workflow, and split CD targets for app vs. BRouter; updates the "BRouter segment management" and "CD pipeline" requirements accordingly.
- `observability`: adds scraping/log shipping for the remote BRouter host over the private network, scoped to BRouter containers only.
- `security-hardening`: adds the shared-secret auth requirement for BRouter and the private-network-only exposure rule.

## Impact

- **Code**: `apps/planner/app/lib/brouter.ts` (add `X-BRouter-Auth` header, read `BROUTER_AUTH_TOKEN`); planner server env wiring.
- **Infrastructure**: `infrastructure/docker-compose.yml` (remove brouter service + segments volume); new `infrastructure/brouter-host/` directory with the remote compose file, Caddy sidecar config, and segment-download script.
- **CI/CD**: `.github/workflows/cd-brouter.yml` (retarget host, new secrets `BROUTER_DEPLOY_HOST` / `BROUTER_DEPLOY_SSH_KEY` / `BROUTER_AUTH_TOKEN`); `cd-infra.yml` no longer touches BRouter.
- **Secrets**: new entries in `infrastructure/secrets.infra.env` (SOPS) for `BROUTER_AUTH_TOKEN`; new GitHub Actions secrets for the new host's SSH key and hostname.
- **Observability**: update `infrastructure/prometheus/prometheus.yml` with a new scrape target over the vSwitch; update `infrastructure/promtail/` to pull logs from the remote host (via Docker socket proxy or a shipped-from agent).
- **Documentation**: `CLAUDE.md` (note the second host); `docs/architecture.md` (topology diagram and failure modes); `docs/deployment.md` if present.
- **Dependencies**: no npm/package changes. Requires Hetzner vSwitch configured between the two hosts (operator action).
- **Operational risk**: BRouter becomes a second SPOF reachable only over vSwitch. Monitored via existing `brouter_request_duration_seconds` histogram in the Planner; cutover includes a 48 h rollback window with the old container kept warm on the primary host.
