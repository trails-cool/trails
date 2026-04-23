## Context

The flagship instance today runs on a single Hetzner Cloud cx23 (2 vCPU / 4 GB RAM / 40 GB SSD). `infrastructure/docker-compose.yml` brings up Journal, Planner, Postgres+PostGIS, BRouter, Caddy, Prometheus, Loki, Promtail, Grafana, and exporters in one compose project. BRouter currently serves Europe-only RD5 tiles (see `cd-brouter.yml` tile list) and shares the 4 GB memory budget with Postgres, the Loki stack, and the Node runtimes. The Planner proxies all BRouter requests; clients never talk to BRouter directly (`apps/planner/app/lib/brouter.ts`).

A second Hetzner host in the same datacenter is already provisioned. It is a general-purpose self-hosted box (3 TB RAID, 32 GB RAM) running unrelated workloads. We own a non-root `trails` user there with docker-group membership; we do not own root, sudo, the firewall, or the host's own observability agents. The host and the flagship Cloud box can be joined on a Hetzner vSwitch.

Other relevant context:
- `cd-brouter.yml` currently SSHes as `root` into `DEPLOY_HOST` and runs `docker compose up -d brouter` against the shared compose project.
- Secrets are SOPS-encrypted in `infrastructure/secrets.app.env` / `infrastructure/secrets.infra.env`, with `AGE_SECRET_KEY`, `DEPLOY_SSH_KEY`, `DEPLOY_HOST` as the only GitHub Actions secrets today.
- The Planner reads `BROUTER_URL` from a single env var (`apps/planner/app/lib/brouter.ts:1`) and makes unauthenticated HTTP requests. There's no existing auth path.
- `brouter_request_duration_seconds` already tracks BRouter latency from the Planner side (see `observability` spec) and surfaces in Grafana.

## Goals / Non-Goals

**Goals:**
- BRouter runs on the dedicated host with planet-wide RD5 coverage and a memory budget sized for global routing.
- All BRouter traffic flows over a private Hetzner vSwitch; no public port for BRouter.
- Planner → BRouter requests are authenticated with a shared secret so that a misconfigured vSwitch or firewall mistake doesn't silently expose the service.
- Deployment works end-to-end as the non-root `trails` user with only docker-group privileges.
- BRouter container metrics and logs reach the flagship instance's Grafana without polluting trails.cool observability with the shared host's other workloads.
- Cutover is reversible for 48 h via `BROUTER_URL` rollback.

**Non-Goals:**
- Failover / multi-upstream BRouter. A separate change (`brouter-failover-or-degradation`, deferred) handles that.
- Touching the shared host's firewall, SSH configuration, or other tenants' services. Operator confirms the vSwitch interface is reachable and the host firewall allows the flagship's private IP to hit the BRouter container's published port; no further host-level config is in scope for this change.
- Migrating other trails.cool services off the flagship box.
- Automated segment updates. Manual re-run of the segment script is fine for now.

## Decisions

### 1. Transport: Hetzner vSwitch, same DC

**Decision:** Join the flagship and the dedicated host on a Hetzner vSwitch. BRouter's Caddy sidecar binds the published port to the vSwitch IP only.

**Alternatives:**
- *WireGuard overlay.* Works without vendor lock-in; adds a daemon, key rotation, and another moving part on a host we don't fully own. vSwitch is simpler when both endpoints are Hetzner in the same DC.
- *Public port + firewall allowlist + TLS.* Would require managing certs on a host we don't run Caddy/Let's Encrypt on natively, plus IP allowlist drift if the flagship ever changes IPs.

**Rationale:** vSwitch is Hetzner-native, low-latency (sub-ms, same DC), encrypted at the hypervisor level, and removes public exposure entirely. The shared-secret header (below) is defense-in-depth against vSwitch misconfiguration.

### 2. Auth: shared-secret header enforced by a Caddy sidecar

**Decision:** Run a thin Caddy container on the dedicated host in front of BRouter. Caddy requires `X-BRouter-Auth: <token>` on every request; missing/wrong token → 403 before BRouter ever sees the request. The Planner reads `BROUTER_AUTH_TOKEN` from env and sets the header on every fetch in `apps/planner/app/lib/brouter.ts`.

**Alternatives:**
- *mTLS.* Stronger but requires cert rotation and adds operational weight for a single consumer.
- *Host-based IP allowlist alone.* Relies entirely on network config; a vSwitch routing mistake becomes an auth bypass. Layered defense is cheap.
- *BRouter-native auth.* BRouter has no auth plugin; forking or patching Java is out of proportion.

**Rationale:** One 32-byte random token in SOPS, one header on every proxy request, one `@require_header` Caddy matcher. Minimal code and config surface.

### 3. Deploy user: `trails` with docker group, no sudo

**Decision:** The deploy workflow SSHes as `trails@<brouter-host>` using a dedicated key. The workflow runs `docker compose` inside `~trails/brouter/`, pulls `ghcr.io/trails-cool/brouter:latest`, and restarts. All files under `~trails/brouter/` are owned by `trails:trails`. Segment downloads also run as `trails` via a script in the same directory.

**Alternatives:**
- *Root SSH.* Matches the current pattern but requires privileges we don't have on the shared host.
- *Systemd user service.* Adds another deployment model inconsistent with the rest of the fleet.

**Rationale:** Docker-group membership is sufficient to run compose. No sudo needed. Keeps the blast radius contained to the `trails` account — consistent with the shared-host constraint.

### 4. Segment coverage: global from day one

**Decision:** Download the full planet RD5 set (~60–80 GB) to `~trails/brouter/segments/` on first deploy. Script downloads per-tile, idempotent, resumes where it left off.

**Alternatives:**
- *Europe first, global later.* Lower cutover risk but requires a second migration.
- *On-demand segment download.* BRouter supports only mounted segments; on-demand requires a fork.

**Rationale:** Disk is abundant (3 TB available, segments use <3%). Global from the start matches the motivation of the move and avoids a second cutover.

### 5. Memory: `-Xmx8g` JVM heap on a 32 GB host

**Decision:** Set `JAVA_OPTS=-Xmx8g` (or the equivalent `brouter.sh` arg) on the BRouter container. Leave the rest for Linux page cache, which matters more for cold-segment reads than heap.

**Alternatives:**
- *`-Xmx16g`.* Diminishing returns; segment LRU cache at 8 GB already holds a large working set. Page cache is a better spend for the remaining RAM.
- *`-Xmx4g`.* Fine for low concurrency; leaves no headroom for bursts across disjoint planet regions.

**Rationale:** Matches observed sizing of public planet-scale BRouter instances. Revisit if `brouter_request_duration_seconds` p95 degrades under load.

### 6. Observability: scrape the container, not the host

**Decision:** From the flagship's Prometheus, scrape the BRouter container's exposed metrics port over vSwitch (either BRouter's own `/metrics` if enabled, or a sidecar JMX exporter). Also scrape a cAdvisor instance running on the dedicated host, filtered by container label to BRouter only. Loki collects logs via a Promtail/Alloy container running as `trails` tailing the BRouter container's stdout only.

**Alternatives:**
- *Shared host `node_exporter`.* Would mix trails.cool metrics with unrelated workloads. Not ours to report on, and noisy.
- *Run Prometheus locally on the dedicated host.* Splits observability into two Grafanas. The CLAUDE.md rule is "observability continues to live in trails internal grafana."
- *Ship metrics via remote_write only.* Adds complexity without benefit given the vSwitch is already low-latency.

**Rationale:** Scrape over vSwitch is the simplest path that keeps the data in the existing Grafana. Scoping to the BRouter container (not the host) respects the shared-host boundary.

### 7. Cutover: parallel stand-up with env-var flip

**Decision:**
1. Stand up BRouter on the dedicated host, seed segments, validate with a curl-over-vSwitch + auth-header test.
2. Add `BROUTER_AUTH_TOKEN` to SOPS; deploy Planner with the new token but still pointing at `http://brouter:17777` (old upstream). Verify the token is wired but unused.
3. Flip `BROUTER_URL` in the Planner env to the new vSwitch URL. Deploy Planner. Monitor `brouter_request_duration_seconds` for error rate + latency.
4. Leave the old BRouter container running on the flagship for 48 h; document the rollback as a single `BROUTER_URL` change.
5. After 48 h of clean metrics, remove the `brouter` service from `infrastructure/docker-compose.yml`, delete `/opt/trails-cool/segments/`, and update `cd-infra.yml` to skip BRouter.

**Rationale:** Single-variable flip with a warm rollback. `BROUTER_URL` is already an env var; no code branching needed.

## Risks / Trade-offs

- **vSwitch misconfig leaves BRouter unreachable.** → The shared-secret header means the service can be public-IP-reachable as a fallback during a vSwitch outage without auth regressions; confirm both hosts ping each other over vSwitch before flipping `BROUTER_URL`.
- **Shared host's other workloads interfere with BRouter memory/CPU.** → Pin `-Xmx8g` so JVM behavior is predictable. Monitor host-level memory pressure via an alert on BRouter OOM log lines (shipped via Promtail). Operator can escalate to the shared-host owner.
- **Segment download takes hours; first deploy blocks.** → Run the segment script out-of-band from the CI deploy (manual one-shot `ssh trails@host '~/brouter/download-segments.sh'`). Don't let the workflow time out on a 60 GB download.
- **Auth token leaks in logs or PR reviews.** → Token only lives in SOPS + GitHub Actions secrets. Caddy access logs mask `X-BRouter-Auth` via a `log.filter`. Rotation is a redeploy of Planner + Caddy with a new token.
- **Planner latency increases due to cross-host hop.** → Same-DC vSwitch is ~0.2–0.5 ms extra; p50 impact negligible. If p99 regresses, investigate segment cache hit ratio (likely root cause is global vs. Europe, not the hop).
- **Observability from a host we don't own is fragile** — the shared host's Docker daemon, vSwitch interface, or disk filling from other tenants can all break us silently. → Alert on `up{job="brouter"}` = 0 for 2 minutes, plus a synthetic check from Planner side (existing `brouter_request_duration_seconds` error rate).
- **Only one consumer of the token for now, but token rotation is still a two-place update** (SOPS + Planner redeploy + Caddy redeploy). → Document rotation in runbook; not worth automating yet.

## Migration Plan

See cutover in Decision 7. Rollback: revert the `BROUTER_URL` change in SOPS, redeploy Planner. Old container remains warm for 48 h.

## Open Questions

- Does the dedicated host's network config actually expose a vSwitch interface today, or does the operator need to enable it on the Hetzner side first? (Operator to confirm before implementation starts.)
- Does BRouter expose Prometheus metrics in the current image, or do we need a JMX exporter sidecar? If JMX is needed, add a sub-task.
- Segment update cadence (brouter.de publishes weekly). Start manual; a later change can add a cron on the dedicated host if desired.
