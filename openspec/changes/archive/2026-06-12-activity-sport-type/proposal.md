## Why

Activities have no notion of *what sport they are* — a hike, a gravel ride, and
a trail run are presented identically (a line on a map plus distance and
elevation). Komoot and Strava both lead with the sport: it drives the feed verb
("went hiking" / "was out on a ride"), an icon, filtering, and later per-sport
stats. We already receive the sport on import (Komoot sends it on every tour)
and throw it away. A single nullable field is the smallest net-new addition
that unblocks the most downstream presentation work.

## What Changes

- Add a nullable `sportType` enum to activities: `hike · walk · run · ride ·
  gravel · mtb · ski · other` (nullable = "unspecified", so all existing rows
  and hand-created activities stay valid).
- Expose `sportType` on the activity create form as a `<select>` (optional).
- Map the source sport into our enum on import: Komoot tours carry a sport
  string today (passed through but discarded); normalize it. Garmin's
  notification payload has no sport, so imported Garmin activities stay
  unspecified.
- Surface the sport on the activity detail page, feed cards, and the profile
  activity list as a small badge (icon + label), and use it to phrase the feed
  verb.
- Serialize the sport as a `PropertyValue` attachment on the ActivityPub `Note`
  so federated peers can see it (additive, non-breaking).

## Capabilities

### New Capabilities

- `activity-sport-type`: the sport/activity-type field on activities — its
  enum, how it is set (create form + import normalization), how it is displayed
  (badge + feed verb), and how it is federated.

### Modified Capabilities

<!-- None. Display in the feed/profile is folded into the new capability rather
     than re-opening activity-feed / public-profiles requirements; those specs
     describe aggregation/listing behavior, not per-activity attributes. -->

## Impact

- **Schema**: new nullable `sport_type` column on `journal.activities`
  (additive — `pnpm db:push`, no data migration).
- **Wire contract**: `packages/api` activity read + create schemas gain an
  optional `sportType`.
- **Journal app**: `ActivityInput`/`createActivity`, the create route + action,
  the unified `importActivity` + Komoot import mapping, the detail/feed/profile
  loaders and views, a shared `SportBadge` component, the ActivityPub
  serializer (`federation-objects.server.ts`).
- **i18n**: `journal.activities.sport.*` keys (en + de).
- No breaking changes; the field is optional everywhere.
