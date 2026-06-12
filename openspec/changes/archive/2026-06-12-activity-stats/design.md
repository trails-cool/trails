## Context

Activities store `distance` (m), `duration` (s, elapsed), `elevationGain/Loss`
(m), `startedAt`, and `gpx`. Routes store distance + elevation. The three
surfaces that render these (feed, detail, profile) each hand-roll their own
markup and pick a different subset. There is no shared formatter and no derived
pace/speed.

## Goals / Non-Goals

**Goals**
- One presentation component and one set of formatting/derivation helpers.
- Add average pace/speed and moving-vs-elapsed time as first-class headline
  metrics.

**Non-Goals**
- No imperial/metric toggle in this change — render metric (km, m, km/h, min/km)
  as the baseline; a units preference is a separate future change.
- No per-point analytics charts (that's `journal-elevation-profile`).
- No schema or API changes; everything is derived from existing fields.

## Decisions

### D1: One `StatRow` component
A presentational `StatRow` takes an ordered list of `{ value, label, unit }`
items and renders the shared layout (value prominent, small caption beneath,
even spacing). Feed/detail/profile pass the items they have; the component never
fetches. A `formatStat` helper centralizes number/unit formatting and goes
through i18n.

### D2: Canonical headline set
The headline set, in order, is: **distance · time · avg pace/speed · ascent ·
descent**. Surfaces may render a subset (e.g. the compact feed card may show
distance · time · pace), but never reorder or relabel — the subset is a prefix
or documented selection of the canonical set.

### D3: Average pace vs. speed (sport-aware)
`avgSpeed = distance / movingTime` (fallback elapsed). Presentation chooses:
- **pace** (min/km) for foot sports (`hike`, `walk`, `run`),
- **speed** (km/h) for wheeled/ski sports (`ride`, `gravel`, `mtb`, `ski`),
- default to **speed** when sport type is unset.
This depends on `activity-sport-type`; if that field is absent the rule still
resolves (speed).

### D4: Moving vs. elapsed time
- **Elapsed** = stored `duration`.
- **Moving** = derived from GPX trackpoint timestamps by summing inter-point
  intervals and excluding intervals where the athlete is effectively stationary
  (below a small speed threshold, e.g. < 0.5 m/s, with a max-gap guard). The
  derivation lives in `@trails-cool/gpx` as a pure, unit-tested helper.
- When the GPX has no trackpoint timestamps (planned routes, some imports),
  moving time is unavailable and only elapsed is shown.

### D5: Formatting
`formatStat` formats distance (km, 1 decimal < 100 km), elevation (m, integer),
time (h:mm or m:ss), speed (km/h, 1 decimal), pace (m:ss /km). Labels and unit
suffixes come from `journal.stats.*` i18n keys (en + de).

## Risks / Trade-offs

- **Moving-time heuristic**: stop detection is approximate; the threshold is a
  single documented constant in the gpx helper, tunable later. When in doubt we
  fall back to elapsed, so we never show a moving time longer than elapsed.
- **Subset discipline**: allowing surfaces to render a subset risks drift; the
  canonical order + a shared component keeps it in check, and the spec forbids
  reordering/relabeling.
