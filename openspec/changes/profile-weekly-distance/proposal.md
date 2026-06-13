## Why

The profile roll-up header (`profile-stats`) shows lifetime totals and a
"last 4 weeks" count, but no sense of *cadence* — is this person ramping up,
tapering, or consistent? Strava's weekly bars are the at-a-glance answer. A
small weekly-distance bar chart turns the static totals into a trend, and the
data is the same cheap aggregate we already lean on.

## What Changes

- Add a **weekly distance bar chart** to the profile, under the stats header:
  one bar per week for the **last 12 weeks**, heights normalized to the busiest
  week.
- Compute it with one indexed aggregate (`sum(distance)` grouped by week) over
  the same viewer scoping as `profile-stats` (public-only for visitors, full
  for the owner) — **no cache table, no schema change**.
- Hide the chart when the owner has no distance in the window.

## Capabilities

### New Capabilities

- `profile-weekly-distance`: the weekly-distance bar chart on the profile — the
  window, how empty weeks are shown, and how it is computed and scoped.

### Modified Capabilities

<!-- None at the requirement level. Builds alongside `profile-stats` (the
     header it sits under); that capability's totals are unchanged. -->

## Impact

- **Depends on `profile-stats`** (PR #539) — the chart renders beneath that
  header.
- **Journal app**: a `getWeeklyDistance(ownerId, { publicOnly, weeks })` query
  in `activities.server.ts`; the profile loader passes the series; a small
  `WeeklyDistanceChart` component (SVG bars, reusing `stats.ts` formatters).
- **i18n**: `journal.profileStats.weeklyDistance*` labels (en + de).
- **No schema change, no GPX parsing** — `sum(distance)` grouped by
  `date_trunc('week', …)` over the `owner_id`-leading indexes.
