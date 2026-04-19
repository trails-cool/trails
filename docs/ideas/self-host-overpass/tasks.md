## 1. Overpass host Docker image

- [ ] 1.1 Create `infrastructure/overpass-host/` with a `Dockerfile` wrapping a pinned `wiktorn/overpass-api` release
- [ ] 1.2 Add `infrastructure/overpass-host/scripts/initial-load.sh` that downloads the PBF from `OVERPASS_PBF_URL` and runs the one-shot import
- [ ] 1.3 Document the first-time setup (initial import command, expected duration, disk footprint) in `infrastructure/overpass-host/README.md`

## 2. Overpass host compose

- [ ] 2.1 Add `infrastructure/overpass-host/docker-compose.yml` with the `overpass` service: image, named volume for the OSM DB, env vars (`OVERPASS_PBF_URL`, `OVERPASS_DIFF_URL`, `OVERPASS_META` as needed), healthcheck, restart policy, explicit published port binding on the public interface
- [ ] 2.2 Add the named volume for the OSM database and document the expected disk footprint for the chosen extract

## 3. Firewall (Docker-aware)

- [ ] 3.1 Write an nftables / iptables rule template using the `DOCKER-USER` chain: ACCEPT from `<PLANNER_HOST_IP>` to the overpass port on the public interface, DROP everything else on that port
- [ ] 3.2 Load the Planner host IP from a local env file on the Overpass host (e.g. `/etc/overpass/planner-ip.env`) — do NOT check the IP into the repo
- [ ] 3.3 Add a `scripts/apply-firewall.sh` that renders the rule template, applies it, and persists across reboots (systemd unit or `nftables.conf`)
- [ ] 3.4 Verify rules survive `systemctl restart docker` and `docker compose restart` without clobbering
- [ ] 3.5 Verify an outside host (e.g. laptop home IP) cannot connect to the overpass port; verify the Planner host can

## 4. Planner proxy route

- [ ] 4.1 Create `apps/planner/app/routes/api.overpass.ts` as a React Router action that accepts POST with an Overpass QL body
- [ ] 4.2 Read the upstream URL from `OVERPASS_URL` env var; return 503 with a clear log message when unset or empty
- [ ] 4.3 Enforce session + same-origin: reuse the Planner's existing session cookie check; reject cross-origin with 403
- [ ] 4.4 Stream the upstream response body and status back to the caller; pass through 429s as-is
- [ ] 4.5 Add unit tests covering 401 (no session), 403 (cross-origin), 503 (unset `OVERPASS_URL`), and happy-path forwarding (mock upstream)

## 5. Planner compose wiring

- [ ] 5.1 Add `OVERPASS_URL` to the planner service env in `infrastructure/docker-compose.yml`, pointing at the Overpass host's URL (value held in the SOPS-encrypted env file, not hard-coded)
- [ ] 5.2 Update `cd-infra.yml` SCP sources list if any new files under `infrastructure/` are added

## 6. Rate limiting

- [ ] 6.1 Add an Overpass proxy limiter to `packages/rate-limiting` (or the Planner equivalent) at 20 queries/session/min with a burst of 5
- [ ] 6.2 Return 429 when exceeded; never contact upstream Overpass on rejected requests
- [ ] 6.3 Add a test that rapid-fire requests from one session hit 429 and no upstream call is made

## 7. Planner client switch

- [ ] 7.1 Change `apps/planner/app/lib/overpass.ts` to POST to `/api/overpass` instead of iterating over `OVERPASS_ENDPOINTS`
- [ ] 7.2 Remove the `OVERPASS_ENDPOINTS` constant and the public-endpoint fallback loop
- [ ] 7.3 Update `apps/planner/app/lib/overpass.test.ts` to reflect the new single-endpoint path
- [ ] 7.4 Verify the existing POI error UI (rate-limit banner, unavailable message) still fires on 429 / 5xx from the proxy

## 8. Observability

- [ ] 8.1 Expose an `overpass_up` probe (HTTP healthcheck wrapped as a Prometheus metric — either a blackbox probe or a small sidecar)
- [ ] 8.2 Expose a replication-lag metric derived from the Overpass `replicate_id` / timestamp
- [ ] 8.3 Add a Grafana panel (or extend an existing dashboard) showing Overpass up/down and replication lag

## 9. Documentation

- [ ] 9.1 Update `docs/architecture.md` to reflect that POI queries go via Planner → Overpass host over a firewall-restricted public route
- [ ] 9.2 Update the Planner README (or equivalent) to note the new `OVERPASS_URL` dependency and the one-time initial-load step
- [ ] 9.3 Update the Journal privacy manifest to remove references to third-party Overpass hosts

## 10. Cutover

- [ ] 10.1 Initial import on the Overpass host via the documented one-shot procedure; confirm query works end-to-end from the Planner UI
- [ ] 10.2 Monitor Sentry, Grafana Overpass panel, and error rate in the Planner POI UI for 24 h
- [ ] 10.3 Remove any transitional feature flag; public Overpass endpoints are no longer referenced anywhere in the repo
