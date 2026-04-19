## Context

The Planner's POI overlays issue Overpass QL queries from the browser to `overpass.kumi.systems` (primary) and `overpass-api.de` (fallback) via `apps/planner/app/lib/overpass.ts`. These are community-run services with shared rate limits; during the alpha we will quickly exceed what is socially acceptable for a free public resource, and every browser tab that opens the Planner leaks its viewport coordinates to those third-party hosts.

BRouter is already self-hosted and already demonstrates the access-restriction pattern we want to reuse: the browser never calls BRouter directly — it POSTs to the Planner server's `/api/route`, which rate-limits by session and then calls `http://brouter:17777` on the compose-internal Docker network. BRouter has no `ports:` mapping and no Caddy route, so it simply isn't reachable from the public internet. No token, no CORS — topology is the boundary.

Two constraints shape the Overpass design differently from BRouter:
- The existing Hetzner compose host has 40 GB of SSD; the BRouter segment files fit comfortably but a Germany Overpass DB is already ~40–60 GB and Europe is ~200–350 GB. Running Overpass next to BRouter is not viable.
- The maintainer has a second Hetzner server in the same datacenter (FSN1) with 1.8 TB free. Running Overpass there is cheap and generous, but it puts the backend on a *different host* — so the compose-internal network that protects BRouter doesn't exist naturally, and we need an equivalent private network between the two Hetzner boxes.

## Goals / Non-Goals

**Goals:**
- Run our own Overpass endpoint on the dedicated server
- Make the Planner use that endpoint exclusively for POI queries
- Keep the endpoint off the public internet — same security posture as BRouter today
- Keep POI latency comparable to or better than current public endpoints
- Keep the instance up-to-date via daily diff replication

**Non-Goals:**
- Serve Overpass publicly to other apps outside trails.cool
- Host Overpass on the Hetzner compose host (won't fit)
- Replace the Overpass stack with a custom engine — we want query-level compatibility
- Add per-user quotas (Planner is anonymous; per-session is enough)

## Decisions

### Topology: host-level firewall allowlist between two Hetzner boxes

**Decision:** Keep both hosts on their existing Hetzner public IPs (no overlay, no vSwitch). On the Overpass host, configure nftables so the Overpass port only accepts connections from the Planner host's egress IP; drop everything else. The Planner server proxy calls the Overpass host directly over Hetzner's internal backbone, which routes the traffic at ~1 ms RTT and never leaves Hetzner's network.

**Alternatives considered:**
- **Tailscale overlay** — stronger (encrypted transport, resilient to IP changes, MagicDNS hostnames) but adds a daemon on both hosts and a third-party control plane. Useful as a future hardening step, not needed for v1.
- **Self-hosted WireGuard** — same as Tailscale minus the third party, more key-management work.
- **Hetzner vSwitch** — native Hetzner VLAN-tagged private network between dedicated and Cloud. Free, no daemons, but requires Robot + Cloud configuration and a VLAN sub-interface on the dedicated server.
- **Public Caddy + mTLS** — exposes an Overpass URL publicly behind client certs; more moving parts than we need.
- **Bearer token + public endpoint** — tokens in env vars are operationally awkward and don't add anything over a firewall allowlist for the server-to-server case.

**Why firewall allowlist:** It is the smallest change that reproduces BRouter's "topology is the boundary" property. Traffic already routes inside Hetzner's network (sub-ms RTT confirmed); the only additional thing we need is for the Overpass host's kernel to reject packets that don't originate from the Planner host. No daemon, no control plane, no cert rotation.

**What we give up:** transport is not encrypted (Hetzner backbone, but still), and if the Planner host's egress IP ever changes we have to update the allowlist. Both are acceptable trade-offs for v1; Tailscale is the obvious upgrade path if either bites.

### Making the firewall actually work with Docker

**Decision:** Use the `DOCKER-USER` nftables/iptables chain for the allowlist. Docker runs this chain *before* its own FORWARD rules and will never touch it, so user-defined rules are not clobbered on container restart or daemon reload.

**Why this matters:** Docker publishes ports by inserting rules into `PREROUTING` (DNAT) and `FORWARD` that run *before* the host's `INPUT` chain. A naïve `-A INPUT -p tcp --dport 8080 -j DROP` silently does nothing — the packet is already NATed into the container's network namespace before `INPUT` is consulted. This is a classic gotcha and has bitten us before.

**Rule shape (parameterised by the Planner host IP, which is *not* checked into the repo):**
1. `iptables -I DOCKER-USER -i <wan-iface> -s <planner-host-ip> -p tcp --dport <overpass-port> -j ACCEPT`
2. `iptables -I DOCKER-USER -i <wan-iface> -p tcp --dport <overpass-port> -j DROP`
3. Persist via `iptables-save` + systemd unit or `nftables.conf`.

The Planner host IP lives in an env file on the Overpass host (e.g. `/etc/overpass/planner-ip.env`), loaded by the rule-apply script. Rotating it is a single variable edit and a script rerun.

**Alternatives:**
- **`network_mode: host` on the Overpass container** — skips Docker's NAT entirely; the container listens directly on the host network, so regular `INPUT` rules work. Simpler rule logic, but the container has to bind a specific host port and port conflicts become the operator's problem. Keep as a fallback if `DOCKER-USER` ever surprises us.
- **`iptables=false` in Docker daemon config** — disables Docker's automatic rule management entirely, but then we own every NAT rule manually. Too invasive.
- **Bind the published port to `127.0.0.1` only** — doesn't work here because we need trails.cool to reach it over the public interface.

### Which Overpass image to run

**Decision:** Use the community `wiktorn/overpass-api` Docker image, pinned, wrapped in `infrastructure/overpass-host/`.

**Why:** Most widely deployed, actively maintained, handles PBF import + diff replication out of the box, matches the query surface the browser already uses. Wrapping it in our own directory gives us a single place for configuration.

### Extract size

**Decision:** Start with a Germany (or DACH) extract. The `OVERPASS_PBF_URL` is an env var so switching extracts is a data-load step, not a code change.

**Why:** Disk on the dedicated host is plentiful (~2 TB free) but RAM is the binding constraint. With ~23 GB available on the Overpass host after existing services, Germany (8–16 GB working set) or DACH (10–18 GB) fit comfortably and leave headroom for the page cache. Europe (32+ GB) would evict the host's other services and hit swap — not acceptable on a shared box. Planet (~128 GB) is out of scope for this hardware. Treat DACH as the practical ceiling for this deployment; scaling to Europe+ is a deliberate hardware decision (more RAM, or a different host), not a silent incident.

### Access restriction model

**Decision:** Same two-boundary model as BRouter, adapted for the two-host topology:

1. **Browser → Planner server** (`/api/overpass`):
   - Requires Planner session cookie (same cookie the rest of the Planner uses)
   - Same-origin / Origin-header check as defense-in-depth
   - Per-session rate limit via the existing `packages/rate-limiting` capability
2. **Planner server → Overpass** (Tailscale):
   - Overpass binds only to the Tailscale interface
   - Planner resolves `overpass.tailnet` over MagicDNS and connects on the private network
   - No token required because the network itself is the auth boundary — same logic as BRouter

**What CORS does *not* do here:** CORS only restricts browsers from *reading* cross-origin responses; it doesn't stop `curl` or any non-browser client from sending requests. An `Origin` check at the proxy is worth having, but only as defense-in-depth — the real protection is that Overpass isn't on the public internet.

### Rate limiting

**Decision:** Extend `packages/rate-limiting` with a per-session bucket for `/api/overpass`: ~20 queries/min with a burst of 5. Exceeded requests return 429; the existing POI UI already handles 429.

**Why:** Matches the client's debounced pan/zoom traffic; a scripted misuse hits the ceiling immediately. Mirrors how `/api/route` protects BRouter.

### Data refresh

**Decision:** Use `wiktorn/overpass-api`'s built-in replication pointing at Geofabrik's daily diffs. Nothing to schedule externally.

**Why:** Zero operational overhead; daily staleness is fine for POIs.

### Where the initial load runs

**Decision:** The one-shot PBF import runs on the Overpass host via `docker compose run --rm overpass-loader`, operator-invoked, documented in `infrastructure/overpass-host/README.md`. Replication takes over afterwards.

**Why:** Initial import takes hours and can't block a normal deploy loop; it's a one-time operation.

## Risks / Trade-offs

- **Tailscale dependency** → Tailscale's control plane is a third party. Data plane is peer-to-peer and keeps working during control-plane outages; new connections may fail briefly. Mitigation: monitor via the existing observability stack; consider self-hosted Headscale or WireGuard if we outgrow the Tailscale free tier or want to remove the dependency.
- **Two-host operational burden** → The dedicated server adds a host to keep patched and monitored. Mitigation: minimal compose (Overpass only), same backup/monitoring approach as Hetzner.
- **Shared-host coupling** → The Overpass host is a general-purpose server already running unrelated services. trails.cool now depends on that host's uptime, and any RAM pressure from other services can degrade Overpass query latency (and vice versa). Mitigation: cap the Overpass working set at DACH-scale so it never competes for the last few GB of RAM; monitor available memory on that host alongside Overpass health.
- **Initial import eats hours of maintainer time** → Scripted in `infrastructure/overpass-host/scripts/initial-load.sh`, documented, run once per extract change.
- **Replication drift** → Expose replication lag as a Prometheus metric via the existing observability stack (Prometheus scrapes over Tailscale). Alert at >48 h.
- **Removing public fallback removes resilience** → If our Overpass is down, POI overlays are broken until it's back. Trade-off vs. privacy and reliability; accept it and treat Overpass like BRouter.
- **Blast radius on proxy bugs** → A bug in `/api/overpass` skipping the rate limiter could let a malicious tab exhaust the backend. Mitigation: limiter enforced by middleware, not per-route code; integration tests cover the 429 path.

## Migration Plan

1. Tailscale onboarding: create a tailnet, install Tailscale on the Hetzner host, install on the dedicated server, verify ping over the mesh.
2. On the dedicated server: check out `infrastructure/overpass-host/`, run the one-shot PBF import, start the service, confirm it responds on the Tailscale interface only.
3. Merge the Planner code changes behind an env var (`OVERPASS_URL`) that defaults to the public endpoint; set the env var to the Tailscale URL on Hetzner.
4. Flip the client code to use `/api/overpass`. Monitor error rate and latency.
5. Once stable, remove the public-endpoint fallback and the env-var override, locking in the self-hosted path.

**Rollback:** Change `OVERPASS_URL` back to a public endpoint URL. The dedicated server stays up but unused. No data migration.

## Open Questions

- First-cut extract: Germany only, or DACH? Planet is overkill for alpha even with 1.8 TB of disk.
- Do we add a Grafana panel for Overpass query volume + replication lag in the same PR, or ship the service first and add observability as a follow-up?
- Should the proxy cache Overpass responses (Redis / in-memory) on top of the existing client-side cache, given many Planner sessions pan over the same cities?
- Prometheus scraping over Tailscale: scrape from the Hetzner Prometheus across the tailnet, or run a local exporter on the Overpass host and push?
