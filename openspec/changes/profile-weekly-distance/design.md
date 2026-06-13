## Context

`profile-stats` added `getActivityStats` (a single indexed aggregate over stored
columns) and a `ProfileStats` header. This change adds a per-week breakdown
beneath it. `activities` has `distance`, `started_at`, `created_at`,
`visibility`, and `owner_id`-leading indexes.

## Goals / Non-Goals

**Goals**
- A compact weekly-distance trend on the profile, cheap and viewer-scoped.

**Non-Goals**
- No per-week elevation/time toggle, no selectable window in v1 (fixed 12
  weeks).
- No hover tooltip framework — a native `title` per bar is enough.
- No "where I've been" map (separate idea).

## Decisions

### D1: One grouped aggregate — still no cache
`SELECT date_trunc('week', coalesce(started_at, created_at)) AS wk,
        sum(distance) AS m
 FROM journal.activities
 WHERE owner_id = $1 [AND visibility = 'public']
   AND coalesce(started_at, created_at) >= now() - interval '12 weeks'
 GROUP BY wk`.
Bounded to 12 weeks and filtered on the `owner_id` index, this scans a tiny
recent slice and returns ≤ 12 rows — same cost class as the lifetime aggregate
(`profile-stats` §D1). No cache table; the documented escape hatch there covers
this too.

### D2: Gap-fill in JS
The query returns only weeks that have activities. The server fills the result
to a contiguous 12-week series (oldest → newest) with `0` for empty weeks, so
the chart always has a stable 12-bar axis. Week boundaries follow Postgres
`date_trunc('week', …)` (ISO weeks, Monday start).

### D3: Viewer scoping
Identical to `profile-stats`: `publicOnly: !isOwn`. Same WHERE clause shape;
remote-ingested rows (`owner_id NULL`) never appear.

### D4: Presentation
A small SVG bar chart (`WeeklyDistanceChart`) under the stats header: 12 bars,
heights normalized to the max week, each bar carrying a `title` with its week
distance (formatted via `stats.ts`). Renders nothing when every week is 0
(no distance in the window). Read-only, no interactivity beyond the native
title.

## Risks / Trade-offs

- **Fixed 12-week window** — a power user with a long history sees only the
  recent quarter. Acceptable for a cadence glance; a selectable range is a
  future enhancement.
- **Distance-only** — elevation/time trends are deferred to keep the chart
  legible and the query single-column.
