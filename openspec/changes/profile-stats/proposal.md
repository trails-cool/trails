## Why

A profile (`/users/:username`) is a list of routes and activities with no
sense of the person behind it — no "how far have they gone", no recent
cadence. Komoot leads its profile with lifetime totals (tours · distance ·
time); Strava with a "last 4 weeks" activity count. A small stats header makes
a profile feel like someone's outdoor life rather than a table, and every
number is already in the `activities` table.

## What Changes

- Add a stats header to the profile page showing **lifetime totals**: activity
  count, total distance, total ascent, total time (elapsed).
- Add a **recent-activity** summary: the count of activities in the last 4
  weeks (rolling).
- Scope the roll-up to what the viewer may see: a visitor sees **public-only**
  totals; the owner viewing their own profile sees totals over **all** their
  activities.
- Compute on the fly with a single indexed aggregate query — **no cache table,
  no schema change** (see design for the cost analysis and the future-cache
  escape hatch).

## Capabilities

### New Capabilities

- `profile-stats`: the profile stats header — which totals are shown, how they
  are scoped by viewer/visibility, and how they are computed.

### Modified Capabilities

<!-- None at the requirement level. `public-profiles` owns the page shell and
     the full-vs-locked-stub access rule; this is an additive header it renders. -->

## Impact

- **Journal app**: a new aggregate query in `activities.server.ts`
  (`getActivityStats(ownerId, { publicOnly })`); the profile loader
  (`users.$username.server.ts`) calls it and the page renders a stats header
  (reusing the shared `StatRow` where it fits).
- **i18n**: `journal.profileStats.*` labels (en + de).
- **No schema change, no migration, no GPX parsing** — aggregates use the
  stored `distance` / `elevation_gain` / `duration` columns over the existing
  `owner_id`-leading indexes.
