## Context

The Planner computes accurate per-coordinate surface/highway from BRouter's
`WayTags` (`apps/planner/.../route-merge.ts` → `EnrichedRoute`) and colours the
line with it, but it's session-only: `api.save-to-journal` POSTs only `{ gpx }`,
`routes` has no surface column, GPX carries no surface tags. The repo already
has a typed pg-boss job system (`apps/journal/app/jobs/payloads.ts`,
`@trails-cool/jobs`), an SSE broker (`/api/events` + EventSource hooks, e.g.
`useUnreadNotifications`), and an Overpass proxy used for Planner POIs
(`apps/planner/.../overpass.ts`, `/api/overpass`).

## Goals / Non-Goals

**Goals**
- Surface + waytype bars on route **and** activity detail.
- Two derivation paths: free/accurate for Planner routes; async backfill for
  everything else, with a live SSE update.

**Non-Goals (v1)**
- Colouring the Journal **map line** by surface (needs per-segment data, not the
  summary; a clean follow-up).
- Re-backfilling on every geometry edit (backfill is one-shot per row unless
  re-triggered).

## Decisions

### D1: Two derivation paths into one stored summary
Both paths produce the same compact, distance-weighted summary —
`{ surface: { asphalt: <m>, gravel: <m>, … }, highway: { … } }` (metres per
category) — stored as nullable `surface_breakdown` jsonb on `routes` and
`activities`. The bars need proportions, not geometry, so we store a summary,
not per-segment data (per-segment is a future map-colouring concern).

- **Path 1 — synchronous, Planner routes (accurate, free).** The Planner has
  100%-accurate per-segment tags; compute the summary at save and persist via an
  extra optional `surfaceBreakdown` field in the handoff. No external call.
- **Path 2 — async backfill, everything else (best-effort).** For a row with
  geometry but no summary, a job map-matches to OSM and computes it (D2).

### D2: The async backfill job
A typed `surface-backfill` pg-boss job keyed by `{ kind: "route" | "activity",
id }`:
1. Load the geometry; bail if absent or already has a summary.
2. Query Overpass for `way[highway]` within the route bbox (a journal-side
   client mirroring the Planner's `buildQuery`/`parseResponse` + rate-limit
   handling).
3. **Map-match**: for each route segment, find the nearest OSM way and read its
   `surface`/`highway`; bucket the segment's length. Unmatched/untagged →
   `unknown`.
4. Store the summary; emit the SSE event (D3).
- **Triggers:** enqueued after a GPX import (Komoot/Garmin) and after a manual
  upload; plus a one-off sweep job to backfill pre-existing rows. Optionally
  enqueued on-demand when a detail page without a summary is opened.
- **Resilience:** pg-boss retries cover Overpass rate-limits/outages; the job is
  idempotent (skips if a summary already exists) and best-effort (failure leaves
  the row with no bars, not an error).

### D3: SSE live update
On backfill completion the job publishes a `surface_breakdown` SSE event
(payload: `{ kind, id }`) via the existing broker. The detail page subscribes
(EventSource hook) and, when the event matches the row it's showing, re-fetches
the breakdown and fills the bars — so a user who opened the page before the job
finished sees it appear without reloading. While a backfill is known to be
in-flight, the page may show a small "computing…" affordance.

### D4: Rendering
A `SurfaceBreakdown` component: one horizontal stacked bar per dimension
(surface, then waytype), segments sized by percentage and coloured via
`SURFACE_COLORS`/`HIGHWAY_COLORS` (`DEFAULT_*` for unknown), with a legend
(category · km · %, largest first). Unknown/unmapped tags collapse into "other".
Hidden when the summary is null/empty. Labels via i18n; distances via `stats.ts`.

### D5: Privacy (backfill sends geometry to Overpass)
Path 1 sends nothing externally. Path 2's Overpass query exposes a route's
bounding box to the Overpass endpoint — a real consideration for a privacy-first
app. Mitigations: route the backfill through the **proxied / self-hostable**
Overpass (the parked `self-host-overpass` idea removes the third-party entirely),
and only the bbox + geometry needed for matching is sent. We document the
backfill's external lookup in the privacy manifest; a self-hosted Overpass is the
clean long-term answer.

## Risks / Trade-offs

- **Map-matching is approximate** — nearest-way snapping mismatches at junctions
  / parallel ways; acceptable for a proportional overview, and Path 1 (exact) is
  preferred whenever available.
- **Overpass cost/limits** — bounded by the async queue + retries; the sweep
  should throttle. A self-hosted Overpass removes the ceiling.
- **Two code paths** — both converge on one stored summary + one renderer, so
  only the *derivation* differs.
