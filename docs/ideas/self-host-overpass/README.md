# self-host-overpass (parked — superseded for POIs)

Full OpenSpec artifact set (`proposal.md`, `design.md`, `specs/`, `tasks.md`)
for hosting our own Overpass API. Moved here from `openspec/changes/` so it
does not clutter the active change list; revive by moving the directory back
under `openspec/changes/` when ready to implement.

## Status

**Superseded for the Planner's POI overlays** by the
[`poi-index`](../../../openspec/changes/poi-index/) change (shipped), which
removes Overpass from the POI path entirely: instead of running the Overpass
software, a monthly osmium extract feeds a self-hosted PostGIS `planner.pois`
index served at `/api/pois`. That is lighter than this plan (no Overpass
engine, no diff replication, no RAM ceiling) and covers every current POI need
— all queries were simple tag-in-bbox lookups that never used Overpass QL.

The former interim proxy (`/api/overpass` → `overpass.private.coffee`) has been
**removed**.

**Still relevant if** we ever need genuine Overpass QL (arbitrary ad-hoc
queries, recursion, `around:`, set operations) that a precomputed category
index can't answer — that's the remaining reason to revive this. The Journal's
surface-breakdown backfill still queries public Overpass instances for way
geometry; owning that upstream is the other revive trigger.

## When to revive

Revisit once **any** of these is true:

- private.coffee rate-limits our traffic or changes policy
- Our query volume makes continued use of a free public instance feel like
  abuse (rule of thumb: >1 req/s sustained)
- We want POI coverage outside regions private.coffee happens to import
- Privacy posture requires full control of the upstream

## Key decisions already made

- **Topology**: Overpass runs on the maintainer's second Hetzner box
  (FSN1, dedicated, i7-2600, 32 GB, 2×3 TB HDD, 1.8 TB free). Both hosts
  share Hetzner's internal backbone with ~1 ms RTT.
- **Access control**: host-level firewall via nftables `DOCKER-USER` chain
  (Docker bypasses `INPUT` when publishing ports, which is the classic
  gotcha). Only the Planner host's egress IP is allowed on the Overpass
  port. Planner host IP lives in `/etc/overpass/planner-ip.env` on the
  Overpass box, **not** in the repo. Tailscale / WireGuard / vSwitch kept
  as future hardening options.
- **Capacity ceiling on current hardware**: DACH extract fits comfortably
  in the 23 GB of RAM available on the Overpass box. Europe+ would need
  different hardware (AX52 ≈ €54/mo for a dedicated 64 GB NVMe box that
  handles planet at low user counts; see design.md).
- **Switch path**: no client changes needed to cut over — the Planner
  proxy reads `OVERPASS_URLS` (comma-separated list with round-robin
  fallback) or the single-entry alias `OVERPASS_URL`, defaulting to
  `lz4.overpass-api.de` then `overpass-api.de`. Flipping the env var
  points at our own instance.

## What's in the folder

- `proposal.md` — why / what / impact
- `design.md` — topology, firewall pattern, capacity analysis, risks
- `specs/` — delta specs (would land against `overpass-hosting`,
  `osm-poi-overlays`, `infrastructure`, `rate-limiting`)
- `tasks.md` — 10 groups of implementation tasks
- `.openspec.yaml` — OpenSpec scaffolding; keep for when it comes back
