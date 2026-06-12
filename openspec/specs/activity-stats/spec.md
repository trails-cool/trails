# activity-stats Specification

## Purpose
TBD - created by archiving change activity-stats. Update Purpose after archive.
## Requirements
### Requirement: Reusable stat row
The UI SHALL render activity and route headline metrics through one shared stat-row component (value, localized label, unit) used on the feed card, the activity and route detail pages, and the profile activity list.

#### Scenario: Same component across surfaces
- **WHEN** distance is shown on the feed card, the detail page, and the profile list
- **THEN** all three render it via the shared stat-row component with the same label, unit, and formatting

#### Scenario: Compact subset keeps order
- **WHEN** a surface renders a subset of the headline metrics
- **THEN** the subset preserves the canonical order and labels (no reordering or relabeling)

### Requirement: Canonical headline metric set
The system SHALL define the canonical headline metric set, in order, as distance, time, average pace or speed, ascent, and descent.

#### Scenario: Detail page shows the full set
- **WHEN** a user views an activity with distance, duration, and elevation data
- **THEN** distance, time, average pace/speed, ascent, and descent are shown in that order

### Requirement: Average pace or speed, chosen by sport
The system SHALL compute an average rate from distance and time and SHALL present it as pace for foot sports (hike, walk, run) and as speed for wheeled or ski sports (ride, gravel, mtb, ski), defaulting to speed when the sport type is unset.

#### Scenario: Pace for a run
- **WHEN** an activity with sport type `run` is shown
- **THEN** the rate is presented as pace (min/km)

#### Scenario: Speed for a ride
- **WHEN** an activity with sport type `ride` is shown
- **THEN** the rate is presented as speed (km/h)

#### Scenario: Default when sport is unset
- **WHEN** an activity has no sport type
- **THEN** the rate is presented as speed

### Requirement: Moving time and elapsed time
The system SHALL display elapsed time and SHALL additionally display moving time when it can be derived from GPX trackpoint timestamps; when timestamps are unavailable, only elapsed time SHALL be shown.

#### Scenario: Both shown when trackpoint times exist
- **WHEN** an activity's GPX has trackpoint timestamps with stationary periods
- **THEN** both moving time and elapsed time are shown, and moving time is not greater than elapsed time

#### Scenario: Elapsed only when no timestamps
- **WHEN** an activity has no trackpoint timestamps
- **THEN** only elapsed time is shown

### Requirement: Localized metric formatting
The system SHALL format metric values and unit suffixes through localized strings, covering distance, elevation, time, speed, and pace.

#### Scenario: German units
- **WHEN** the UI locale is German
- **THEN** metric labels and unit suffixes render in German

