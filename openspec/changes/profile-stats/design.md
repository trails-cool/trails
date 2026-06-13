## Context

`journal.activities` stores `distance`, `elevation_gain`, `duration` (elapsed),
`started_at`, `visibility`, and `owner_id`, with `owner_id`-leading indexes
(`activities_owner_started_idx`, `activities_owner_created_idx`). The profile
page already distinguishes the owner (`isOwn`) from other viewers and already
lists public activities via `listPublicActivitiesForOwner`.

## Goals / Non-Goals

**Goals**
- A lifetime-totals + recent-activity header on the profile, scoped correctly
  by viewer.
- Cheap, simple computation that scales to power users.

**Non-Goals**
- No per-week distance chart / sparkline in v1 (a clean follow-up once the
  totals land).
- No "where I've been" heat/cluster map (separate idea; privacy-sensitive).
- No moving-time roll-up — moving time needs per-activity GPX parsing, far too
  costly to aggregate; roll-ups use stored **elapsed** `duration` only.

## Decisions

### D1: Compute on the fly — no cache table (the cost question)
Roll-ups are a single aggregate over stored columns:
`SELECT count(*), sum(distance), sum(elevation_gain), sum(duration)
 FROM journal.activities WHERE owner_id = $1 [AND visibility = 'public']`.
Filtered by `owner_id` (the leading column of two existing indexes) and summing
already-materialized columns, this is an index range scan + a streaming
aggregate — **sub-millisecond to low-single-digit-ms even at tens of thousands
of activities**. The "expensive with many activities" risk is real for N+1 or
unindexed scans, not for one indexed `GROUP BY`-free aggregate.

A materialized cache table (`user_activity_stats`, bumped on activity
create/update/delete, visibility change, and import) buys nothing at realistic
scale and adds invalidation surface + drift risk — against the repo's
simplicity principle. **Documented escape hatch:** if profiling ever shows this
is hot (e.g. a heavily-followed instance rendering many profiles), the same
query result can be memoized into a `user_activity_stats` row maintained by the
existing mutation paths; the read API (`getActivityStats`) stays identical, so
it's a drop-in with no caller changes.

### D2: Viewer scoping
- **Other viewers** see **public-only** totals (`visibility = 'public'`) —
  consistent with the public activity list already shown and with privacy
  defaults (unlisted/private never counted).
- **The owner** viewing their own profile sees totals over **all** their
  activities (the "your outdoor life" number), matching Komoot/Strava.
The loader already knows `isOwn`, so it passes `publicOnly: !isOwn` to one
parameterized query.

### D3: Recent-activity window
"Last 4 weeks" = `started_at >= now() - interval '28 days'` (fall back to
`created_at` when `started_at` is null, matching the list sort). Counted with
the same viewer scoping. A fixed 4-week rolling window (Strava's framing) keeps
it a single extra count, no date-bucketing.

### D4: Presentation
A compact stats header above the routes/activities lists: activity count,
distance, ascent, elapsed time, and a "N in the last 4 weeks" line. Reuse the
shared `StatRow` for the four totals where it fits; format via the existing
`stats.ts` helpers (distance/elevation/duration). Empty state (no activities)
hides the header.

## Risks / Trade-offs

- **Two query shapes (owner vs. public)** — trivially handled by a conditional
  WHERE; both hit the same index.
- **Remote-ingested activities** have `owner_id = NULL` (authored by a remote
  actor), so they never count toward a local profile's totals — correct.
