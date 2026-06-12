## Why

Distance, duration, and elevation are rendered ad-hoc and inconsistently across
the feed card, the activity/route detail page, and the profile list — different
spacing, different label casing, and a different subset of metrics on each
surface. Komoot and Strava both lead with one crisp, repeated metric row. We
also discard derivable headline numbers: **average pace/speed** (we have
distance + duration) and **moving vs. elapsed time**. A single reusable stat
component plus those derived metrics makes every surface scannable and is a
natural piece of the launch-blocking visual redesign.

## What Changes

- Introduce one reusable `StatRow` presentation component (value + localized
  label + unit), used identically on the feed card, the activity & route detail
  pages, and the profile activity list.
- Define the canonical headline metric set and render it consistently:
  distance, time, average pace **or** speed, ascent, descent.
- Derive **average pace or speed** and choose the right one per sport (pace for
  foot sports, speed for wheeled/ski), degrading to speed when sport is unset.
- Show **moving time** alongside **elapsed time** when moving time can be
  derived from GPX trackpoint timestamps; otherwise show elapsed only.
- Localized number/unit formatting via i18n.

## Capabilities

### New Capabilities

- `activity-stats`: the canonical headline-metric set, the derived metrics
  (average pace/speed, moving vs. elapsed time), and the reusable stat-row
  presentation used across the feed, detail, and profile surfaces.

### Modified Capabilities

<!-- None at the requirement level. The feed (`activity-feed`) and profile
     (`public-profiles`) specs describe aggregation/listing, not the metric set;
     the shared presentation is a new capability they consume. -->

## Impact

- **Journal app**: a new shared `StatRow` (and a small `formatStat`/derivation
  helper); the feed, activity-detail, route-detail, and profile views adopt it;
  their loaders expose the fields needed to derive the metrics (already mostly
  present: distance, duration, startedAt, elevation, plus `gpx` for moving
  time).
- **i18n**: `journal.stats.*` keys (en + de) for labels and units.
- **Builds on** `activity-sport-type` for the pace-vs-speed choice (graceful
  fallback if that change is not yet merged).
- No schema or wire-contract change; metrics are derived from existing fields.
