## MODIFIED Requirements

### Requirement: FIT to GPX conversion
The system SHALL convert FIT binary files to GPX format. The conversion logic lives at `apps/journal/app/lib/connected-services/fit.ts` — a provider-agnostic location shared across any future provider that produces FIT files (Garmin, Coros, etc.). Wahoo's importer and webhook both import from this shared module; they do not contain their own copy. The conversion SHALL be pause- and session-aware: timer stop/start events (or record gaps over 5 minutes in files without events) and session boundaries each start a new track segment. The converter SHALL prefer enhanced (corrected) altitude and speed fields, drop records with missing timestamps or non-finite/out-of-range coordinates, treat non-finite altitude as absent, and expose the file's session sport mapped to the Journal's sport types alongside the GPX.

#### Scenario: Convert FIT with GPS data
- **WHEN** a FIT file contains GPS track records
- **THEN** track points with lat, lon, elevation, and ISO 8601 timestamps are extracted
- **AND** coordinates are used as-is from the FIT parser (which already converts semicircles to degrees)
- **AND** a valid GPX string is produced using `generateGpx`

#### Scenario: FIT without GPS data
- **WHEN** a FIT file has no GPS records (e.g., indoor trainer workout)
- **THEN** the activity is created without GPX or geometry (stats only)

#### Scenario: Workout without FIT file
- **WHEN** a workout has no file URL (e.g., aborted recording, third-party app data)
- **THEN** the activity is created without GPX or geometry

#### Scenario: Pause becomes a segment boundary
- **WHEN** a FIT file contains a timer stop event followed by a start event 20 minutes later
- **THEN** the GPX contains two track segments split at the pause
- **AND** moving time computed downstream does not include the paused span

#### Scenario: Multisport file keeps one activity with per-session segments
- **WHEN** a FIT file contains multiple sessions
- **THEN** one GPX is produced with one or more track segments per session, records sliced to each session's time window

#### Scenario: Corrupt records dropped
- **WHEN** a FIT file contains records with out-of-range coordinates or missing timestamps
- **THEN** those records are excluded and the remaining track converts normally

#### Scenario: Sport surfaced from the file
- **WHEN** a FIT file's session declares sport "cycling" with sub-sport "gravel_cycling"
- **THEN** the converter reports sport `gravel` for the importer to use when the provider sends no explicit type
