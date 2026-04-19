## Why

The Planner's POI overlays depend on public Overpass API instances (`overpass.kumi.systems`, `overpass-api.de`) called directly from the browser. These instances are community-run, rate-limit aggressively, have no SLA, and every Planner user contends for the same pool — on launch we would be abusing someone else's free service and relying on it to stay up. Hosting our own Overpass keeps the Planner working under load, lets us tune rate limits for our traffic, and lets us stop leaking our users' viewport coordinates to a third party. The endpoint must be locked to Planner traffic only so we are not inadvertently running a free public Overpass mirror for the rest of the internet.

## What Changes

- Overpass runs on a **separate Hetzner server** the maintainer already owns in FSN1 (1.8 TB free disk), not on the existing Hetzner compose host, since the latter is storage-constrained (40 GB SSD) while Germany alone is ~40–60 GB and Europe is ~200–350 GB
- The Overpass host runs a **host-level firewall (nftables) that only accepts traffic from the Planner host's egress IP** on the Overpass port. Both hosts sit in Hetzner FSN1 and measured RTT is ~1 ms over Hetzner's internal backbone, so no overlay network is needed for latency. The firewall allowlist gives us the same "only trails.cool can reach it" property as a VPN, with zero extra daemons. No public Caddy route, no public DNS record — the port exists but all packets from any other source are dropped at the kernel.
- Tailscale/WireGuard remains on the table as a future hardening step (transport encryption, IP-rotation resilience) and is explicitly documented as a migration path.
- On the Overpass host: a small Docker Compose file running a community Overpass image with a configurable OSM extract URL and built-in diff replication for daily updates
- Planner server gains an `/api/overpass` proxy route that forwards queries to `http://<overpass-host>:8080` on the private network — mirrors how `/api/route` already proxies to the internal BRouter
- Planner browser code switches from public Overpass endpoints to the Planner's own `/api/overpass` — the two public endpoints are removed from the fallback list
- Access restriction is **exactly the BRouter model**, just extended across two hosts: browser → Planner (same-origin + session + rate limit) → private network → backend. CORS/origin checks on the proxy are defense-in-depth, not the primary boundary.
- Rate limiting: per-session budget on the proxy route (e.g. 20 queries/min) layered on top of the existing `packages/rate-limiting` capability
- **BREAKING**: `apps/planner/app/lib/overpass.ts` stops talking to public Overpass hosts

## Capabilities

### New Capabilities
- `overpass-hosting`: Operate a self-hosted Overpass API instance fed from a regional OSM extract with nightly diff updates, fronted only by an authenticated planner proxy route. Covers the container, the data import and refresh lifecycle, the proxy route contract, and the access-restriction model.

### Modified Capabilities
- `osm-poi-overlays`: POI queries now route through the Planner's `/api/overpass` proxy instead of public Overpass endpoints. The public-endpoint fallback requirement is removed.
- `infrastructure`: Adds a new long-running service (Overpass) to the compose stack, with a volume for the OSM database, a separate CI/CD workflow for the initial data load, and monitoring hooks for replication lag.
- `rate-limiting`: Adds a per-session bucket for `/api/overpass` to protect the underlying service.

## Impact

- **Code**: `apps/planner/app/lib/overpass.ts` (endpoint change), new route `apps/planner/app/routes/api.overpass.ts`, `packages/rate-limiting` integration for the new route
- **Infrastructure (existing Hetzner host)**: Add `OVERPASS_URL` env var to the Planner container pointing at the Overpass host. No new compose service on this host.
- **Infrastructure (Overpass Hetzner host)**: New `infrastructure/overpass-host/` directory with its own compose file, Dockerfile wrapper, nftables ruleset (parameterised by the Planner host IP — not checked in), and one-shot data-load script. Deployed independently of the existing CD pipelines.
- **Data**: With 1.8 TB of headroom we can run an extract as large as Europe (~200–350 GB) or even planet without redesign. Start with the extract that matches current user base and scale later — the choice is a data-load decision, not a schema decision.
- **Privacy**: Removes third-party leakage of viewport coordinates to public Overpass hosts; aligns with the Planner's privacy-first principle.
- **Rollback**: If the self-hosted instance is unhealthy, we can point `/api/overpass` back at a public endpoint via env var — but the long-term contract is that public endpoints are no longer used.
