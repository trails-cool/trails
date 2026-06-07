# Multi-day activity collections

Pre-spec exploration. This is `docs/architecture.md`'s **explicit open
question #1** (§Multi-Day Route Support: "Exact data model for
collections TBD — needs more design work"). Multi-day *routes* shipped
(day-break waypoints, per-day stats, track segments per day); the
activity side — recording a 5-day bikepacking trip as one entity with
five day-recordings — is captured nowhere.

## The shape from the architecture

- A multi-day activity is a **collection linking individual
  day-activities**
- Each day-activity keeps its own GPS trace, photos, description
  (possibly imported from different devices/apps per day)
- The collection references the planned multi-day route as a whole
- Day-activities can be imported one at a time (Garmin/Komoot/Wahoo per
  day) and attached as the trip progresses

## Data-model directions to evaluate

1. **Collection row + membership table** —
   `journal.trips (id, owner, name, description, route_id?)` +
   `journal.trip_activities (trip_id, activity_id, day_index)`.
   Activities stay fully independent (visibility, federation, photos);
   the trip is a presentation/grouping layer. Cheapest; probably right.
2. **Self-referencing activities** (`parent_activity_id` + a `kind`
   column). Fewer tables but overloads the activity model and makes
   feed/outbox queries carry exclusion rules forever.
3. Whatever we pick must answer: trip-level visibility vs per-day
   visibility (suggest: trip visibility caps day visibility), trip-level
   stats (sum of days), and how a trip federates (one Note per day as
   today, plus a trip page link? A trip-level Note at completion?).

## Notes

- Pairs naturally with `activity-participants.md` (group trips) and the
  "Tour mode" sketch in `fediverse-enhancements.md` (day N/M check-in
  posts are trivial once a trip entity exists).
- The route side already encodes day breaks in GPX track segments —
  importing a multi-day route's recording per segment could pre-seed
  day-activities.
- Keep GPX exportability: a trip should export as one GPX with track
  segments per day (mirror of the route format), preserving the
  data-ownership principle.
