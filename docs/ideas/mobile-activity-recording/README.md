# mobile-activity-recording (parked)

OpenSpec change for recording GPS activities on-device in the mobile app
(ride/hike tracking, live stats, save as Journal activity, HealthKit /
Health Connect export). Moved here from `openspec/changes/` so it does not
clutter the active change list; revive by moving the directory back under
`openspec/changes/` when ready to implement.

## Status

**Parked.** Blocked on `mobile-app` (the foundation change) landing first,
and on there being enough Journal users actually logging activities to
justify the native-recording complexity. At the current user count (3) and
activity count (0), shipping this would be writing code for nobody.

## When to revive

Revisit once **any** of these is true:

- The mobile app is live and users are asking to record from the phone
  instead of importing from Wahoo/Garmin/Komoot later
- The web Journal has a meaningful stream of imported activities, so the
  feature lands into an existing behaviour rather than inventing one
- A specific user request justifies the iOS/Android background-location
  privacy review (App Store's bar for background GPS is high)

## Key constraints to remember

- **Background GPS requires explicit user consent + justification** on iOS
  and Android. App Store privacy review will scrutinise this.
- **Dependencies**: `expo-location` for the track, plus `expo-health` (or
  equivalent) for HealthKit / Health Connect integration.
- **Battery**: continuous GPS at high accuracy is a power-hungry path;
  recording UI needs clear on/off state and resumption.

## What's in the folder

- `proposal.md` — why / what / impact
- `specs/` — delta specs (would land against a new `mobile-activity-recording` capability)
