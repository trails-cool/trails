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

- [ ] 2.1 Generate a 32-byte random `BROUTER_AUTH_TOKEN`
- [ ] 2.2 Add `BROUTER_AUTH_TOKEN` to `infrastructure/secrets.infra.env` (SOPS) and commit the re-encrypted file
- [ ] 2.3 Add `BROUTER_AUTH_TOKEN` to `infrastructure/secrets.app.env` (SOPS) for the Planner
- [ ] 2.4 Add GitHub Actions secrets: `BROUTER_DEPLOY_HOST`, `BROUTER_DEPLOY_SSH_KEY`
- [ ] 2.5 Document the rotation runbook in `docs/deployment.md` (or equivalent)

## 3. BRouter host compose project

- [ ] 3.1 Create `infrastructure/brouter-host/docker-compose.yml` with services `brouter` (bound only to the internal Docker network) and `caddy` (published on the vSwitch IP, auth-enforcing)
- [ ] 3.2 Create `infrastructure/brouter-host/Caddyfile` that requires `X-BRouter-Auth` equal to the configured token and forwards matching requests to `brouter:17777`; redact the header from access logs
- [ ] 3.3 Set `JAVA_OPTS=-Xmx8g` (or equivalent BRouter env) on the `brouter` service
- [ ] 3.4 Create `infrastructure/brouter-host/download-segments.sh` that fetches the planet RD5 tile list idempotently into `./segments/`
- [ ] 3.5 Add a README in `infrastructure/brouter-host/` with one-shot provisioning notes (`git clone`, first segment download, first compose up)

## 4. Planner changes

- [ ] 4.1 Add `BROUTER_AUTH_TOKEN` env var to `apps/planner/app/lib/brouter.ts`; send `X-BRouter-Auth` on every fetch
- [ ] 4.2 Fail the Planner startup with a clear error when `NODE_ENV=production` and `BROUTER_AUTH_TOKEN` is unset
- [ ] 4.3 Update `infrastructure/docker-compose.yml` Planner service env to pass `BROUTER_AUTH_TOKEN` through from the SOPS env file
- [ ] 4.4 Add a unit test covering the header-attachment path in `apps/planner/app/lib/brouter.ts`

## 5. CD workflow

- [ ] 5.1 Rewrite `.github/workflows/cd-brouter.yml` deploy job: SSH as `trails@${{ secrets.BROUTER_DEPLOY_HOST }}`, `cd ~trails/brouter`, `docker compose pull && docker compose up -d`
- [ ] 5.2 Update workflow `paths:` trigger to include `infrastructure/brouter-host/**`
- [ ] 5.3 Move the segment-download logic out of the workflow into the on-host `download-segments.sh`; workflow calls it but tolerates a long-running invocation (or skips on subsequent deploys if segments already present)
- [ ] 5.4 Keep the Grafana annotation step, pointing at the flagship Grafana over its existing path
- [ ] 5.5 Remove the `brouter:` service from `infrastructure/docker-compose.yml` on the flagship (deferred to cutover step 7.5)

## 6. Observability

- [ ] 6.1 Add a Prometheus scrape job in `infrastructure/prometheus/prometheus.yml` targeting the BRouter host's cAdvisor (or JMX exporter) on the vSwitch IP; label with `host="brouter"`
- [ ] 6.2 Run cAdvisor on the dedicated host as part of `infrastructure/brouter-host/docker-compose.yml`, configured to report only BRouter-labeled containers
- [ ] 6.3 Add a Promtail (or Alloy) service to `infrastructure/brouter-host/docker-compose.yml` tailing Docker logs for BRouter + Caddy sidecar only, pushing to the flagship Loki over vSwitch
- [ ] 6.4 Add a Grafana dashboard row (or new dashboard) for BRouter host: request rate, p50/p95/p99, JVM heap, container memory, scrape up/down
- [ ] 6.5 Add an alert: `up{job="brouter"} == 0 for 2m`

## 7. Cutover

- [ ] 7.1 Deploy `infrastructure/brouter-host/` to the dedicated host manually the first time; run `download-segments.sh` (expect multi-hour runtime)
- [ ] 7.2 Verify the new BRouter responds to a curl from the flagship host over vSwitch with the auth header, and returns 403 without it
- [ ] 7.3 Deploy the Planner with `BROUTER_AUTH_TOKEN` set but `BROUTER_URL` still pointing at the flagship BRouter (no-op change; validates wiring)
- [ ] 7.4 Flip `BROUTER_URL` in SOPS to the new vSwitch URL; deploy Planner; monitor `brouter_request_duration_seconds` error rate for 30 minutes
- [ ] 7.5 After 48 hours of clean metrics: remove the `brouter` service + `./segments` volume from `infrastructure/docker-compose.yml`; run `cd-infra.yml` to restart without BRouter; `docker image prune` on the flagship
- [ ] 7.6 Document rollback path (revert `BROUTER_URL` flip, redeploy Planner, old container warm for 48h) in the PR description

## 8. Documentation

- [ ] 8.1 Update `CLAUDE.md` to mention the second deployment target and the `trails`-user deploy pattern for BRouter
- [ ] 8.2 Update `docs/architecture.md` with the new topology and vSwitch boundary
- [ ] 8.3 Update `docs/deployment.md` (or create) with the BRouter host runbook: first-time provisioning, segment updates, token rotation, rollback
- [ ] 8.4 Add a note to `infrastructure/README.md` (if present) distinguishing flagship-host vs. BRouter-host compose projects

## 9. Verification

- [ ] 9.1 `pnpm typecheck && pnpm lint && pnpm test` pass with the new env handling and unit test
- [ ] 9.2 `pnpm test:e2e` passes with the Planner hitting the relocated BRouter (or a mocked upstream that enforces the auth header)
- [ ] 9.3 A manual smoke test from Grafana confirms BRouter metrics and logs appear under the `brouter` host label after cutover
- [ ] 9.4 `openspec archive relocate-brouter-to-dedicated-host` runs cleanly after cutover + documentation are merged
