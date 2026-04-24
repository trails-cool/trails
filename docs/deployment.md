# Deployment runbook

trails.cool runs on two Hetzner hosts. This document covers what an
operator needs to know beyond the `CLAUDE.md` summary.

## Hosts

| Role | Host | IPs | SSH |
|------|------|-----|-----|
| Flagship (Cloud) | `trails.cool` | public + `10.0.0.2` (vSwitch) | `ssh -i ~/.ssh/trails-cool-deploy root@trails.cool` |
| BRouter (Dedicated) | `ullrich.is` | public `176.9.150.227` + `10.0.1.10` (vSwitch) | `ssh -i ~/.ssh/trails-brouter-deploy -p 2232 trails@ullrich.is` |

Both hosts are in `fsn1` (Falkenstein) and joined on Hetzner vSwitch
#80672 (VLAN 4000). The flagship's Terraform (`infrastructure/terraform/`)
owns the Cloud Network + subnets + server attachment. The dedicated
host's VLAN sub-interface is configured out-of-band via netplan
(`/etc/netplan/60-trails-vswitch.yaml`), because the Robot side isn't
in the Hetzner Cloud API.

## BRouter host — first-time provisioning

See `infrastructure/brouter-host/README.md`. The short version:

```bash
# As root (one-time firewall allowances):
ufw allow in on enp4s0.4000 from 10.0.0.2 to any port 17777 proto tcp \
  comment 'trails brouter via flagship vSwitch'
ufw allow in on enp4s0.4000 from 10.0.0.2 to any port 8080 proto tcp \
  comment 'trails brouter cadvisor via flagship vSwitch'

# As the trails user:
cd ~/brouter  # created by the first cd-brouter deploy
./download-segments.sh   # ~10 GB, a few minutes on a good connection
docker compose pull
docker compose up -d
```

## Secrets rotation

Tokens (including `BROUTER_AUTH_TOKEN`):

1. Generate: `openssl rand -base64 32`
2. Edit: `SOPS_AGE_KEY_FILE=~/.config/sops/age/keys.txt sops infrastructure/secrets.app.env`
3. Commit + push + merge → `cd-apps` redeploys the Planner with the new token.
4. Touch anything under `infrastructure/brouter-host/` (or run `gh workflow run cd-brouter.yml`) → `cd-brouter` redeploys the Caddy sidecar with the new token.
5. Brief overlap window where Planner sends new token while Caddy still checks the old value. Both redeploys should complete within a minute of each other; in the worst case a few Planner requests get 403 and retry.

SOPS on macOS looks for the age key at `~/Library/Application Support/sops/age/keys.txt` by default. If yours lives under XDG-standard `~/.config/sops/age/keys.txt`, set `SOPS_AGE_KEY_FILE` as above or `export` it in your shell rc.

## Cutover procedure (flagship BRouter → dedicated host)

This is how `BROUTER_URL` gets flipped. Do it once the dedicated host
is provisioned, segments are seeded, and the compose project is up.

1. **Pre-flight**: `curl -sfH "X-BRouter-Auth: $(sops -d infrastructure/secrets.app.env | grep ^BROUTER_AUTH_TOKEN= | cut -d= -f2-)" http://10.0.1.10:17777/brouter?lonlats=11.58,48.13\|11.59,48.14\&profile=trekking\&alternativeidx=0\&format=gpx` from the flagship. Expect 200 with GPX. Then curl without the header — expect 403.
2. **Wire the token** without flipping the URL. Edit SOPS: `sops infrastructure/secrets.app.env` — the `BROUTER_AUTH_TOKEN` is already in there. If `BROUTER_URL` isn't in SOPS, skip; the compose has a default. Merge. Planner redeploys; it now sends the header to the flagship BRouter (which ignores it).
3. **Flip the URL**. In SOPS, add `BROUTER_URL=http://10.0.1.10:17777`. Merge. `cd-apps` redeploys the Planner.
4. **Monitor**. Grafana "BRouter (dedicated host)" dashboard + `brouter_request_duration_seconds` on the Overview board. Watch for 30 minutes.
5. **Rollback** (if needed): remove the `BROUTER_URL` line from SOPS (falls back to the flagship default). Merge; redeploy. The flagship container is still warm during the soak window.
6. **Decommission flagship BRouter** (after 48 h of clean metrics): remove the `brouter:` service + `./segments` volume from `infrastructure/docker-compose.yml`. Merge. `cd-infra` restarts without BRouter. Reclaim ~2 GB of segment volume on the flagship.

## Full restart (flagship)

```bash
gh workflow run cd-infra.yml -f restart_all=true
```

Restarts every flagship service. Does NOT touch the BRouter host.

## cd-brouter manual trigger

```bash
gh workflow run cd-brouter.yml
```

Useful to redeploy the BRouter host after token rotation or a config
change, without needing a real source change under
`infrastructure/brouter-host/`.
