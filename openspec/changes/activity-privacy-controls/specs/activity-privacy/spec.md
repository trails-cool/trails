## ADDED Requirements

### Requirement: Per-signal privacy flags
Each activity SHALL carry four independent privacy flags — `hideStartTime`, `hideLocation`, `hideMap`, `hidePace` — orthogonal to its visibility level. For non-owner viewers: `hideStartTime` reduces the start time to date precision; `hideLocation` removes the location label; `hideMap` removes geometry, map, thumbnail, GPX download, and position data in the elevation profile; `hidePace` removes pace, speed, and moving time while keeping distance and elapsed duration.

#### Scenario: Share the ride, hide the departure
- **WHEN** a public activity has `hideStartTime` and `hidePace` set and a non-owner views it
- **THEN** they see the date (not time), distance, duration, map, and photos, but no pace, speed, or moving time

#### Scenario: Hidden map removes all geometry surfaces
- **WHEN** `hideMap` is set and a non-owner requests the activity page, its GPX download, its thumbnail, or its elevation data
- **THEN** no coordinates reach them through any of those surfaces (elevation, if shown, is distance/altitude only)

#### Scenario: Owner sees everything
- **WHEN** the owner views their flagged activity
- **THEN** all data renders, with indicators showing which fields are hidden from others

### Requirement: User defaults stamped at creation
Users SHALL have activity-privacy defaults in settings; every locally created or imported activity SHALL receive the defaults at creation, and the flags SHALL be editable per activity afterwards. Changing defaults SHALL NOT alter existing activities.

#### Scenario: Default applies to next import
- **WHEN** a user enables `hideStartTime` in defaults and a Wahoo activity syncs
- **THEN** the new activity has `hideStartTime` set

#### Scenario: Per-activity override
- **WHEN** the user clears the flag on that one activity
- **THEN** only that activity's start time becomes visible to others

### Requirement: Masking enforced server-side including federation
Masked fields SHALL be removed before data leaves the server for any non-owner surface — detail loaders, feeds, the public API, and ActivityPub objects (masked fields are omitted from published objects; flag changes trigger an Update). Masking SHALL be implemented in a single shared helper.

#### Scenario: Federated object carries no hidden data
- **WHEN** an activity with `hideMap` federates to a follower on another instance
- **THEN** the published object contains no track geometry

#### Scenario: Every serving route masked
- **WHEN** the regression suite requests a fully-flagged activity as a non-owner across all activity-serving endpoints
- **THEN** no hidden field appears in any response
