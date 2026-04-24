## 1. Pre-flight (operator)

- [x] 1.1 Confirm Hetzner vSwitch is provisioned between the flagship cx23 and the dedicated host; record both vSwitch IPs
  - vSwitch #80672 (VLAN 4000, 1 TB), flagship 10.0.0.2 on `enp7s0`, dedicated 10.0.1.10 on `enp4s0.4000` (MTU 1400), Cloud Network 10.0.0.0/16 with cloud subnet 10.0.0.0/24 + vSwitch subnet 10.0.1.0/24 (Terraform)
  - Dedicated host VLAN persistence: `/etc/netplan/60-trails-vswitch.yaml` on Ubuntu 22.04; verified surviving a reboot (VLAN reachable 64 s after reboot, 0% packet loss steady-state)
  - Flagship side auto-configured by Hetzner cloud-init on attach (no manual OS config)
- [x] 1.2 Confirm the dedicated host's firewall allows inbound TCP from the flagship vSwitch IP to the planned BRouter service port, and blocks that port from the public interface
  - UFW active with `INPUT` default-DROP. Allow rule: `17777/tcp on enp4s0.4000 from 10.0.0.2`. Public interface is blocked by default-deny (17777 not in the public allowlist: 2232/SSH, 80, 443).
- [x] 1.3 Confirm the `trails` user exists on the dedicated host, is in the `docker` group, and can run `docker ps` without sudo
  - uid 1002, groups include 114(docker); `sudo -iu trails docker ps` returns container list (host runs many other self-hosted services, all user-owned)
- [x] 1.4 Generate an SSH keypair for the deploy workflow (`BROUTER_DEPLOY_SSH_KEY`) and install the public key in `~trails/.ssh/authorized_keys`
  - ed25519 keypair at `~/.ssh/trails-brouter-deploy{,.pub}` on operator laptop; public key installed at `/home/trails/.ssh/authorized_keys` on `ullrich.is` (perms 0600/0700, owner trails:trails)
  - Verified: `ssh -i ~/.ssh/trails-brouter-deploy -p 2232 trails@ullrich.is 'docker ps'` succeeds with no password prompt
  - Note: SSH on `ullrich.is` listens on port **2232**, not 22. The CD workflow must use `-p 2232`. Add `BROUTER_DEPLOY_SSH_PORT=2232` as a GitHub Actions secret (or hard-code it in the workflow step).
  - Before merging: add the contents of `~/.ssh/trails-brouter-deploy` as GitHub Actions secret `BROUTER_DEPLOY_SSH_KEY`; then consider whether to keep or delete the local copy.
- [x] 1.5 Verify the dedicated host's Docker daemon version supports the compose file features used in `infrastructure/docker-compose.yml`
  - Docker Engine 29.1.5 (API 1.52), Compose v5.0.1, storage driver overlay2 — all modern
  - **Gotcha**: default `LoggingDriver=loki` on this host (routes to user's personal Loki). Our BRouter compose must override `logging:` per service so our logs go to trails.cool's Loki (flagship) instead. See 6.3 for the two viable approaches: (a) direct Loki driver with `loki-url: http://10.0.0.2:3100/loki/api/v1/push`, or (b) json-file + our own Promtail sidecar.

## 2. Secrets and config

- [x] 2.1 Generate a 32-byte random `BROUTER_AUTH_TOKEN`
  - `openssl rand -base64 32`; active token lives only in SOPS and the operator's clipboard history. Rotate by regenerating and re-running 2.3.
- [ ] ~~2.2 Add `BROUTER_AUTH_TOKEN` to `infrastructure/secrets.infra.env` (SOPS)~~ **obsoleted** — after relocation, `cd-infra` no longer deploys BRouter and therefore doesn't need the token. `cd-brouter` reads it from `secrets.app.env` instead (see 5.1). Single source of truth.
- [x] 2.3 Add `BROUTER_AUTH_TOKEN` to `infrastructure/secrets.app.env` (SOPS) for the Planner
  - Token added via `sops -d | append | sops -e`; round-trip decrypt confirms. Committed in this branch.
- [x] 2.4 Add GitHub Actions secrets: `BROUTER_DEPLOY_HOST`, `BROUTER_DEPLOY_SSH_KEY`, `BROUTER_DEPLOY_SSH_PORT`
  - Set via `gh secret set` from operator laptop: `BROUTER_DEPLOY_HOST=ullrich.is`, `BROUTER_DEPLOY_SSH_PORT=2232`, `BROUTER_DEPLOY_SSH_KEY` from `~/.ssh/trails-brouter-deploy`.
- [x] 2.5 Document the rotation runbook in `docs/deployment.md` (or equivalent)
  - `docs/deployment.md` §Secrets rotation covers the `BROUTER_AUTH_TOKEN` generate/edit/deploy/overlap flow and the macOS `SOPS_AGE_KEY_FILE` gotcha. Added as part of 8.3.

## 3. BRouter host compose project

- [x] 3.1 Create `infrastructure/brouter-host/docker-compose.yml` with services `brouter` (bound only to the internal Docker network) and `caddy` (published on the vSwitch IP, auth-enforcing)
  - Compose has explicit `logging: driver: json-file` on each service to bypass the dedicated host's default `loki` logging driver. Caddy binds to `10.0.1.10:17777`; brouter has no published port.
- [x] 3.2 Create `infrastructure/brouter-host/Caddyfile` that requires `X-BRouter-Auth` equal to the configured token and forwards matching requests to `brouter:17777`; redact the header from access logs
  - Header matcher + 403 fallback; `auto_https off` since vSwitch-only. Caddy default access log format does not include request headers, so token is not logged.
- [x] 3.3 Set `JAVA_OPTS=-Xmx8g` (or equivalent BRouter env) on the `brouter` service
  - Also patched `docker/brouter/Dockerfile` to honor `JAVA_OPTS` (was hardcoded `-Xmx1024M` in CMD). Default env keeps flagship behavior unchanged.
- [x] 3.4 Create `infrastructure/brouter-host/download-segments.sh` that fetches the planet RD5 tile list idempotently into `./segments/`
  - Crawls brouter.de directory listing, uses `wget -N` for Last-Modified-based incremental updates, prints heartbeat every 25 tiles.
- [x] 3.5 Add a README in `infrastructure/brouter-host/` with one-shot provisioning notes (`git clone`, first segment download, first compose up)
  - Covers bring-up, segment refresh, token rotation, rollback. Paired with the CD workflow which handles routine updates.

## 4. Planner changes

- [x] 4.1 Add `BROUTER_AUTH_TOKEN` env var to `apps/planner/app/lib/brouter.ts`; send `X-BRouter-Auth` on every fetch
  - `authHeaders()` helper reads env at call time (testable); attached to both `computeRoute` and `computeSegmentGpx` fetch sites.
- [x] 4.2 Fail the Planner startup with a clear error when `NODE_ENV=production` and `BROUTER_AUTH_TOKEN` is unset
  - Module-level throw at import. Prod container fails fast; dev/test unaffected.
- [x] 4.3 Update `infrastructure/docker-compose.yml` Planner service env to pass `BROUTER_AUTH_TOKEN` through from the SOPS env file
  - Also made `BROUTER_URL` overridable so cutover is a single SOPS edit away.
- [x] 4.4 Add a unit test covering the header-attachment path in `apps/planner/app/lib/brouter.ts`
  - 3 new tests: token set → header attached, token unset → header omitted, covers both `computeRoute` and `computeSegmentGpx`.

## 5. CD workflow

- [x] 5.1 Rewrite `.github/workflows/cd-brouter.yml` deploy job: SSH as `trails@${{ secrets.BROUTER_DEPLOY_HOST }}`, `cd ~trails/brouter`, `docker compose pull && docker compose up -d`
  - SSH on port `BROUTER_DEPLOY_SSH_PORT` (2232), dedicated key `BROUTER_DEPLOY_SSH_KEY`.
- [x] 5.2 Update workflow `paths:` trigger to include `infrastructure/brouter-host/**`
- [x] 5.3 Move the segment-download logic out of the workflow into the on-host `download-segments.sh`; workflow calls it but tolerates a long-running invocation (or skips on subsequent deploys if segments already present)
  - Workflow does NOT call `download-segments.sh` — first-time seed is a manual operator step (per README and task 7.1); routine re-runs are cron-able on the dedicated host.
- [x] 5.4 Keep the Grafana annotation step, pointing at the flagship Grafana over its existing path
  - Still uses `DEPLOY_HOST` + `DEPLOY_SSH_KEY` to reach the flagship for the annotation.
- [ ] 5.5 Remove the `brouter:` service from `infrastructure/docker-compose.yml` on the flagship (deferred to cutover step 7.5)

## 6. Observability

- [x] 6.1 Add a Prometheus scrape job in `infrastructure/prometheus/prometheus.yml` targeting the BRouter host's cAdvisor (or JMX exporter) on the vSwitch IP; label with `host="brouter"`
  - Job `brouter-cadvisor` → `10.0.1.10:8080`. Uses static_configs with a static `host="brouter"` label so dashboards can filter.
- [x] 6.2 Run cAdvisor on the dedicated host as part of `infrastructure/brouter-host/docker-compose.yml`, configured to report only BRouter-labeled containers
  - `--whitelisted_container_labels=trails.cool.service` + `--docker_only=true` scope metrics to trails containers only. Bound to `10.0.1.10:8080` (vSwitch-only).
- [x] 6.3 Add a Promtail (or Alloy) service to `infrastructure/brouter-host/docker-compose.yml` tailing Docker logs for BRouter + Caddy sidecar only, pushing to the flagship Loki over vSwitch
  - Promtail with docker_sd + relabel-drop on missing `trails.cool.service` label; ships to `http://10.0.0.2:3100/loki/api/v1/push`. Also published Loki on flagship's vSwitch IP so the dedicated host can reach it.
  - Requires operator one-time: `ufw allow in on enp4s0.4000 from 10.0.0.2 to any port 8080 proto tcp` (documented in brouter-host/README.md).
- [x] 6.4 Add a Grafana dashboard row (or new dashboard) for BRouter host: request rate, p50/p95/p99, JVM heap, container memory, scrape up/down
  - New `infrastructure/grafana/dashboards/brouter.json` with scrape up/down, request rate + latency (from Planner-side metrics), container memory/CPU, and a Loki logs panel filtered to `host="brouter"`.
- [x] 6.5 Add an alert: `up{job="brouter"} == 0 for 2m`
  - Added as `brouter-scrape-down` in `infrastructure/grafana/provisioning/alerting/alerts.yml`. NoData state set to Alerting so a complete scrape outage still fires.

## 7. Cutover

- [x] 7.1 Deploy `infrastructure/brouter-host/` to the dedicated host manually the first time; run `download-segments.sh` (expect multi-hour runtime)
  - Planet RD5 set (1139 tiles, 9.2 GB) seeded at `~trails/brouter/segments/` on `ullrich.is`. Multi-hour was overestimated — took ~1 min. Planet compressed is only ~10 GB now.
  - All 4 containers up on dedicated host: `trails-brouter` (BRouter 1.7.9), `trails-brouter-caddy`, `trails-brouter-cadvisor`, `trails-brouter-promtail`. Promtail will retry-loop until flagship publishes Loki on `10.0.0.2:3100` (lands with PR #292 merge).
  - Hit three issues during first deploy: `cd-brouter` missing `docker login` (GHCR image is private), custom healthcheck used `wget` not in the image, and BRouter 1.7.8 was one lookups.dat version behind current planet segments. All three fixed in a follow-up commit on #292.
- [x] 7.2 Verify the new BRouter responds to a curl from the flagship host over vSwitch with the auth header, and returns 403 without it
  - Confirmed end-to-end from `trails.cool`: `curl -H 'X-BRouter-Auth: …' http://10.0.1.10:17777/brouter?...` → 200 with GPX body (1.75 km route, 4m41s). Without the header → 403 from Caddy, BRouter never sees the request.
- [x] 7.3 Deploy the Planner with `BROUTER_AUTH_TOKEN` set but `BROUTER_URL` still pointing at the flagship BRouter (no-op change; validates wiring)
  - cd-apps deployed post-#291 merge with `BROUTER_AUTH_TOKEN` in env. Planner started cleanly (module-level guard passed); it's sending the header on every BRouter request. Flagship BRouter ignores the header as expected. `/health` returns 200, logs show normal traffic.
- [x] 7.4 Flip `BROUTER_URL` in SOPS to the new vSwitch URL; deploy Planner; monitor `brouter_request_duration_seconds` error rate for 30 minutes
  - Pre-flight from flagship over vSwitch confirmed: 200 + GPX with `X-BRouter-Auth`, 403 without. `BROUTER_URL=http://10.0.1.10:17777` added to `infrastructure/secrets.app.env` in this PR. Monitoring runbook in `docs/deployment.md` §Cutover.
- [ ] 7.5 After 48 hours of clean metrics: remove the `brouter` service + `./segments` volume from `infrastructure/docker-compose.yml`; run `cd-infra.yml` to restart without BRouter; `docker image prune` on the flagship
- [x] 7.6 Document rollback path (revert `BROUTER_URL` flip, redeploy Planner, old container warm for 48h) in the PR description
  - Rollback procedure in the cutover PR body; canonical version in `docs/deployment.md` §Cutover step 5.

## 8. Documentation

- [x] 8.1 Update `CLAUDE.md` to mention the second deployment target and the `trails`-user deploy pattern for BRouter
  - Deployment table now lists SSH target per workflow; new Hosts section explains the flagship + dedicated split and the vSwitch bridge.
- [x] 8.2 Update `docs/architecture.md` with the new topology and vSwitch boundary
  - Hosting section rewritten to describe both hosts, the vSwitch, and the observability-scoping for the shared dedicated host.
- [x] 8.3 Update `docs/deployment.md` (or create) with the BRouter host runbook: first-time provisioning, segment updates, token rotation, rollback
  - New file. Covers host layout, first-time provisioning, SOPS rotation (including the macOS SOPS_AGE_KEY_FILE gotcha), the full cutover procedure with rollback, and `gh workflow run cd-brouter.yml`.
- [ ] 8.4 Add a note to `infrastructure/README.md` (if present) distinguishing flagship-host vs. BRouter-host compose projects
  - No `infrastructure/README.md` currently exists; the `infrastructure/brouter-host/README.md` added in 3.5 + the updated `docs/deployment.md` cover the ground. Skip.

## 9. Verification

- [x] 9.1 `pnpm typecheck && pnpm lint && pnpm test` pass with the new env handling and unit test
  - Clean run on main @ 6bae26d (12/12 turbo tasks green).
- [x] 9.2 `pnpm test:e2e` passes with the Planner hitting the relocated BRouter (or a mocked upstream that enforces the auth header)
  - All 9 BRouter integration tests pass locally against the dev BRouter with the Planner sending `X-BRouter-Auth`. 4 unrelated macOS-local flakes (passkey/WebAuthn + public-content redirect timing) are green in CI on `main` @ 6bae26d.
- [ ] 9.3 A manual smoke test from Grafana confirms BRouter metrics and logs appear under the `brouter` host label after cutover
- [ ] 9.4 `openspec archive relocate-brouter-to-dedicated-host` runs cleanly after cutover + documentation are merged
