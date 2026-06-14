## Context

The Planner computes accurate per-coordinate surface/highway from BRouter's
`messages`/`WayTags` (`apps/planner/.../route-merge.ts` → `EnrichedRoute`), and
`ColoredRoute` already renders the route coloured by surface. But this metadata
is **session-only**: the planner→journal handoff (`api.save-to-journal`) POSTs
only `{ gpx }` to the Journal callback (`api.routes.$id.callback`), the `routes`
table has no surface column, and GPX carries no surface extensions. So today no
saved route has surface data.

## Goals / Non-Goals

**Goals**
- Surface + waytype proportion bars on route detail, using data we already
  compute, with no new external dependency.

**Non-Goals (v1)**
- **Activities / imported / manually-uploaded GPX** — they have no waytags
  (bare GPX). They show no breakdown for now (see "Data source" → future
  Overpass).
- **Colouring the Journal map line by surface** — needs per-segment data, not
  just the summary; a clean follow-up once the bars land.
- Selectable surface-vs-waytype toggle UI beyond showing both bars.

## Decisions

### D1: Data source — persist BRouter waytags at save (Planner routes only)
Two ways to get a breakdown onto the Journal detail page:

- **(A, chosen) BRouter-at-save** — the Planner already has 100%-accurate
  per-segment surface/highway; compute the distribution there at save and
  persist it. Accurate, cheap, no external call. **Limitation:** only
  Planner-created routes (activities/uploads have no waytags).
- **(B, future) Overpass map-matching** — snap arbitrary route geometry to OSM
  ways and read `surface`/`highway` server-side. Covers imports/uploads, but
  it's expensive, approximate, rate-limited, and an external dependency. Parked
  for when we want imports covered (the repo already proxies Overpass for POIs).

v1 ships (A). Routes without the data degrade to no bars.

### D2: Store a compact distance-weighted summary, not per-segment data
The bars need **proportions**, not geometry. At save, sum the haversine length
of each coordinate segment into its surface bucket (and highway bucket),
yielding `{ surface: { asphalt: <m>, gravel: <m>, … }, highway: { … } }`
(metres per category). This is tiny (a handful of keys), stored as a nullable
`surface_breakdown` jsonb on `routes`. Per-segment data (for future map line
colouring) is deliberately *not* persisted in v1 — that's a bigger payload and
a separate feature.

### D3: Handoff carries it
`api.save-to-journal` adds `surfaceBreakdown` to the POST body alongside `gpx`;
the Journal callback validates (Zod, all values ≥ 0) and stores it. The field
is optional, so the handoff stays backward-compatible and non-Planner callers
(if any) are unaffected. Re-saving a route recomputes/overwrites it.

### D4: Rendering
A `SurfaceBreakdown` component renders one horizontal stacked bar per dimension
(surface, then waytype): segments sized by percentage, coloured via
`SURFACE_COLORS` / `HIGHWAY_COLORS` (`DEFAULT_*` for unknown), with a legend
listing each category + km + percent (largest first). Unknown/unmapped tags
collapse into an "other" segment. Hidden entirely when `surface_breakdown` is
null or empty. Labels via i18n; distances via `stats.ts`.

## Risks / Trade-offs

- **Coverage gap** — only Planner routes get bars in v1. Acceptable: routes are
  *designed* in the Planner, which is exactly where "how much gravel" matters.
  Imports get bars later via (B).
- **Tag sparsity** — OSM `surface` is often missing; those segments bucket as
  `unknown`/"other". We show it honestly rather than guessing.
- **Stale on edit** — editing a route's geometry elsewhere without re-routing
  could leave the breakdown stale; recomputing on every Planner save keeps it
  fresh for the normal flow.
