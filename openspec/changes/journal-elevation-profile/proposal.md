## Why

The Journal's route and activity detail pages show elevation only as two numbers
(gain/loss) even though the full elevation series is already parsed from the
GPX. Both Komoot and Strava treat the elevation profile as the second hero
object after the map, and the interaction that makes a route feel
"inspectable" — hovering the profile to move a marker on the map, and
vice-versa — is the single most satisfying detail-page feature. We already have
this interaction specced and built on the **Planner**
(`elevation-map-interaction`); this change ports a read-only version to the
Journal detail pages.

## What Changes

- Render an elevation profile chart on the route detail and activity detail
  pages: a gradient-filled area chart (x = distance, y = elevation) with a
  summary strip (ascent · descent · highest · lowest).
- Add a shared "active distance" interaction: hovering the chart highlights the
  corresponding point on the Leaflet map (a marker), and hovering the route line
  highlights the corresponding position on the chart. Both stay in sync.
- Clicking a point on the chart centers the map on that location (read-only —
  no editing, unlike the Planner).
- Degrade gracefully: when the GPX has no usable elevation series, the chart is
  omitted (the gain/loss numbers remain).

## Capabilities

### New Capabilities

- `journal-elevation-profile`: the elevation profile chart and the
  chart↔map "active distance" interaction on the Journal's read-only route and
  activity detail pages.

### Modified Capabilities

<!-- None. `elevation-map-interaction` describes the Planner's editing-context
     interaction; this is a separate read-only capability on the Journal detail
     pages. They share the "active distance" concept but not the same surface or
     requirements. -->

## Impact

- **Journal app**: a new `ElevationProfile` chart component, a shared
  "active distance" state lifted over the detail page's map + chart, and wiring
  in `routes.$id.tsx` and `activities.$id.tsx`. Loaders expose the elevation
  series (derived from existing `gpx`).
- **Packages**: reuse `@trails-cool/gpx` for the elevation/distance series and
  `@trails-cool/map-core` for the elevation color scale; no new dependency.
- **i18n**: `journal.elevation.*` keys (en + de) for the summary labels.
- No schema or wire-contract change.
