# BRouter host compose project

Runs on a dedicated Hetzner Robot server (currently `ullrich.is`,
private IP `10.0.1.10` over vSwitch #80672), owned by the non-root
`trails` user. Services:

- **brouter** — the BRouter Java server, planet-scale segments, 8 GB
  JVM heap, no public port.
- **caddy** — thin sidecar enforcing the `X-BRouter-Auth` shared-secret
  header. Bound to `10.0.1.10:17777` (vSwitch IP only).

Public ingress is blocked at the host's UFW (port 17777 is only allowed
on the VLAN interface from `10.0.0.2`, the flagship's vSwitch IP).

## One-time provisioning

Runs as the `trails` user on the dedicated host.

```bash
# 1. Land the compose project
cd ~
git clone https://github.com/trails-cool/trails.git repo
mkdir -p brouter
cp -r repo/infrastructure/brouter-host/* brouter/
cd brouter

# 2. Provide the shared secret (matches BROUTER_AUTH_TOKEN in SOPS)
#    The CD workflow normally writes this file; for manual bring-up,
#    do it yourself.
cat > .env <<'EOF'
BROUTER_AUTH_TOKEN=<paste value from sops -d infrastructure/secrets.app.env | grep BROUTER_AUTH_TOKEN>
EOF
chmod 0600 .env

# 3. Seed segments (multi-hour, ~60–80 GB)
./download-segments.sh

# 4. Start services
docker compose pull
docker compose up -d

# 5. Smoke test from the flagship (over vSwitch)
#    Should return 200 with the token, 403 without.
# ssh root@trails.cool 'curl -sSf -H "X-BRouter-Auth: <TOKEN>" http://10.0.1.10:17777/brouter?lonlats=... '
```

## Subsequent deploys

The `cd-brouter` GitHub Actions workflow handles routine updates:
it pulls the latest image, rewrites the compose file + Caddyfile from
the repo, and restarts.

## Segment updates

Segments are refreshed by brouter.de weekly. To pull updates:

```bash
./download-segments.sh
docker compose restart brouter
```

Schedule via cron if you want automatic updates (not wired in this repo
yet).

## Token rotation

1. Regenerate: `openssl rand -base64 32`.
2. Update SOPS: `sops infrastructure/secrets.app.env` (writer uses the
   `sops -d | append | sops -e` pattern via the CD workflow; editing
   directly works too).
3. Merge the SOPS change to `main`.
4. `cd-apps` redeploys the Planner (sends the new token outbound).
5. `cd-brouter` redeploys Caddy (matches on the new token).
6. Brief overlap window where Planner sends new token but Caddy still
   accepts old: both deploys should fire within a minute of each other,
   so a few 403s are the worst case.

## Rollback

If BRouter is misbehaving and the flagship BRouter is still warm
(during the 48 h soak window post-cutover), flip `BROUTER_URL` in
`infrastructure/secrets.app.env` back to `http://brouter:17777` and
redeploy the Planner. After the soak window, see the change's
design.md for the longer rollback path.

## Logging

The dedicated host's Docker daemon default logging driver is `loki`
(the operator's personal Loki). Our compose file explicitly overrides
each service to `json-file` so logs stay local; a `promtail` sidecar
(section 6.3 of the relocate change) tails them and ships to
trails.cool's Loki over the vSwitch. If you disable that sidecar, the
BRouter logs will NOT flow to trails.cool's Grafana — they'll just
accumulate locally and eventually rotate.
