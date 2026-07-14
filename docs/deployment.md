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

## Flagship disk pressure

The flagship root fs is ~38 GB. When it hits 100%, Postgres can't write and
every app 500s; deploys fail at the SCP step ("error copy file to dest").
Two independent guards keep it in check:

- **Image churn** — `disk-maintenance.yml` prunes unused images daily (04:30
  UTC, `until=12h`); the deploy workflows also prune after each run.
- **Container logs** — every compose service caps its `json-file` logs at
  30 MB (`x-logging` anchor in `docker-compose.yml`). Before that cap a
  single service logging in a loop grew a 2.6 GB log (2026-07-14 outage).

Emergency (disk already full, service down):

```bash
ssh -i ~/.ssh/trails-cool-deploy root@trails.cool
df -h /                                  # confirm 100%
docker image prune -af                   # safe — never removes volumes/data
docker builder prune -f                  # build cache
docker system df                         # what's left; du -xhd1 /var to hunt
# containers self-recover once space frees; re-run the failed deploy after.
```

Never `docker system prune --volumes` — that deletes the Postgres data volume.

## Network-changing deploys (flagship)

Changing options on an existing Docker network (`enable_ipv6`, subnets,
drivers) requires Docker to **recreate** the network — and a network can
only be recreated when *no* container from *any* compose project is
attached. The flagship has three+ projects sharing `trails-shared`
(production, persistent staging, every PR preview), and the CD workflows
only manage their own project, so a network-option change shipped through
`cd-infra` alone WILL deadlock mid-deploy and can leave production down
(this is exactly the 2026-06-06/07 outage: postgres stopped for the
recreation, the deploy failed on the held network, nothing restarted it
for ~9 hours).

The manual procedure, in order, on the flagship:

```bash
cd /opt/trails-cool
# 1. Free trails-shared: down every preview + persistent staging
docker compose ls --filter name=trails-pr- --format json   # enumerate previews
docker compose -f docker-compose.staging.yml -p trails-pr-<N> --env-file staging-pr-<N>.env down
docker compose -f docker-compose.staging.yml -p trails-staging --env-file staging.env --profile persistent down
# 2. Recreate networks via the production project
docker compose --env-file app.env down
docker compose --env-file app.env up -d
# 3. Bring staging + previews back
docker compose -f docker-compose.staging.yml -p trails-staging --env-file staging.env --profile persistent up -d
docker compose -f docker-compose.staging.yml -p trails-pr-<N> --env-file staging-pr-<N>.env up -d
# 4. Verify
docker network inspect trails-cool_default trails-shared --format '{{.Name}} ipv6={{.EnableIPv6}}'
curl -sf https://trails.cool/api/health && curl -sf https://staging.trails.cool/api/health
```

Plan it as a short maintenance window (~2–3 min downtime); don't ship
network-option changes expecting the workflows to apply them.

## Federation runbook

Federation (ActivityPub via Fedify) is gated by `FEDERATION_ENABLED=true`
per environment. Currently: staging **on**, production **off**. The full
change history and design live in `openspec/changes/social-federation/`.

### Enabling on an environment

1. Ensure `FEDERATION_KEY_ENCRYPTION_KEY` is in `secrets.app.env`
   (SOPS) — keypair generation fails closed in production without it.
2. Set `FEDERATION_ENABLED=true` in the environment's compose env (see
   `cd-staging.yml` for the staging pattern).
3. First boot with the flag on enqueues `backfill-user-keypairs`
   (generates RSA keys for existing users — idempotent) and registers
   the federation jobs (`deliver-activity`, `poll-remote-actor`,
   `poll-remote-outboxes`, `federation-kv-sweep`).
4. Smoke: `curl -s "https://<domain>/.well-known/webfinger?resource=acct:<user>@<domain>"`
   (200 for a public user, 404 otherwise) and `/nodeinfo/2.1`.

`FEDERATION_LOG_LEVEL=debug` turns on Fedify's per-request signature
diagnostics (staging runs debug during soaks; dial back to `info`).

### Key rotation

Rotating `FEDERATION_KEY_ENCRYPTION_KEY` requires re-encrypting every
`users.private_key_encrypted` (decrypt with old, encrypt with new) —
there is no script yet; write one against
`apps/journal/app/lib/federation-keys.server.ts` primitives when first
needed. Rotating a single user's keypair: NULL their key columns and
let the backfill regenerate (remotes pick the new key up from the actor
document; deliveries signed with the old key fail until then).

### Abuse monitoring

- Inbox is rate-limited 60 req/5 min per source instance
  (`federationSourceHost`); 429s show in journal logs.
- Outbound is paced (1 req/s delivery, 1 req/5 s polling per host).
- Watch `docker logs <journal>` for `fedify·federation` lines; Loki
  picks them up.

### Blocking an instance

Blocking a domain makes it inert in **both** directions: its inbound
activities are silently dropped (a 202, no error oracle), we send it no
deliveries, and we never fetch its actors/outboxes. Matching is
exact-host. v1 management is a SQL insert/delete against
`journal.federation_blocked_instances` (the table is the seam a future
admin UI can sit on); protocol/moderation semantics are in
[`FEDERATION.md`](../FEDERATION.md).

```sql
-- Block a hostile instance (exact host, no scheme, no path):
INSERT INTO journal.federation_blocked_instances (domain, reason)
VALUES ('bad.example', 'spam / harassment')
ON CONFLICT (domain) DO NOTHING;

-- List current blocks:
SELECT domain, reason, created_at FROM journal.federation_blocked_instances ORDER BY created_at DESC;

-- Unblock:
DELETE FROM journal.federation_blocked_instances WHERE domain = 'bad.example';
```

The block takes effect immediately (checked per-request/per-job, no
cache). Already-queued deliveries to the domain drain from Fedify's
queue; new fan-outs filter it out. An IP/host block in Caddy remains the
harder emergency lever for a flood that shouldn't reach the app at all.

### Troubleshooting deliveries

Hard-won checklist from the 2026-06-06/07 soak (details in
`openspec/changes/social-federation/design.md`):

1. **Test both IP families from inside the journal container** before
   suspecting signatures (`family: 6` vs `4` — dangling A records and
   v6-only instances are common; our containers have IPv6 since
   #466/#468).
2. Remote shows the post count but no posts → remotes never backfill
   outbox history; only pushed or individually-fetched objects appear.
3. Delivered but invisible, no errors anywhere → check the remote's
   `tombstones` table; a previously-retracted URI is refused forever.
4. Mastodon gives deliveries a 10s read timeout — anything synchronous
   and slow in the inbox path breaks federation silently.
5. Actor changes (profile fields, keys) need the remote to re-fetch:
   `tootctl accounts refresh user@domain` on a Mastodon you control.

## cd-brouter manual trigger

```bash
gh workflow run cd-brouter.yml
```

Useful to redeploy the BRouter host after token rotation or a config
change, without needing a real source change under
`infrastructure/brouter-host/`.
