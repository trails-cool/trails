## MODIFIED Requirements

### Requirement: Profile selection
The Planner SHALL support selecting a routing profile that determines how BRouter computes the route.

#### Scenario: Switch routing profile
- **WHEN** a user changes the routing profile (available profiles: `hiking`, `trekking`, `fastbike`, `safety`, `shortest`, `car`)
- **THEN** the profile change syncs via Yjs and the routing host recomputes the route

#### Scenario: Profiles labeled by sport
- **WHEN** the profile selector is displayed
- **THEN** `hiking` is labeled as hiking and `trekking` is labeled as a cycling profile in every locale

## ADDED Requirements

### Requirement: Foot routing profile
The BRouter image SHALL provide a pedestrian routing profile named `hiking` that routes according to foot access rules (footpaths, stairs, and foot-permitted ways are usable; bicycle-specific preferences do not apply). The image build SHALL fail if the `hiking` profile is absent, and the profile SHALL emit the same extra WayTags as the patched stock profiles.

#### Scenario: Hiking profile routes on foot
- **WHEN** a route is requested with profile `hiking` between two points connected directly by a foot-only path
- **THEN** the returned route follows the foot path rather than a road detour

#### Scenario: Existing sessions unaffected
- **WHEN** a session whose Yjs document stores profile `trekking` is opened after the change
- **THEN** routing behavior is identical to before (trekking remains a valid profile)
