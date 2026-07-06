## ADDED Requirements

### Requirement: Offline reverse geocoding
The Journal SHALL derive location labels from a bundled place dataset entirely on-instance; deriving a location SHALL NOT trigger any network request. The lookup SHALL return the nearest populated place with its region and ISO country for a coordinate, falling back to country-only beyond 30 km from any place and to no label beyond 200 km.

#### Scenario: No third-party calls
- **WHEN** an activity is saved and its location derived
- **THEN** no request leaves the instance

#### Scenario: Wilderness start
- **WHEN** a track starts 50 km from the nearest populated place
- **THEN** the label is the country only

### Requirement: Location labels on activities and routes
Activities and routes with geometry SHALL store a derived location label (place name + country) computed from the track's start point at save/import time for locally-created content. Remote (federated) activities SHALL NOT be re-derived locally. Detail pages and feed/list cards SHALL display the label with the country name localized.

#### Scenario: Label on import
- **WHEN** a Wahoo activity starting in Freiburg is imported
- **THEN** the activity shows "Freiburg im Breisgau, Deutschland" in a German locale

#### Scenario: No geometry, no label
- **WHEN** an activity has no GPS data
- **THEN** no location label is stored or shown

### Requirement: Label visibility follows geometry visibility
The location label SHALL be visible to a viewer only when that viewer may see the track's start (same masking as the map/geometry; governed by the activity privacy flags once those exist).

#### Scenario: Hidden geometry hides label
- **WHEN** a viewer is not permitted to see an activity's map/start
- **THEN** the location label is also absent for that viewer

### Requirement: Backfill of existing content
Existing local activities and routes with geometry SHALL receive labels via an idempotent one-shot background job.

#### Scenario: Backfill run
- **WHEN** the backfill job completes
- **THEN** previously saved activities with geometry display location labels
