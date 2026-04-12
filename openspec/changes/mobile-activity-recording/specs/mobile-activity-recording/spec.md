## ADDED Requirements

### Requirement: GPS track recording
The system SHALL record GPS tracks using the device's location services, supporting foreground and background recording.

#### Scenario: Start recording
- **WHEN** the user taps "Start Recording" from a route's map view
- **THEN** GPS tracking begins, the live stats overlay is shown, and track points are stored locally

#### Scenario: Background recording
- **WHEN** the user switches to another app or locks the screen during recording
- **THEN** GPS tracking continues in the background and track points are still recorded

#### Scenario: Stop recording
- **WHEN** the user taps "Stop Recording"
- **THEN** recording ends, track points are converted to GPX, and the user is prompted to save

### Requirement: Live stats display
The system SHALL show real-time statistics during an active recording.

#### Scenario: Stats overlay
- **WHEN** a recording is in progress
- **THEN** the screen displays: elapsed duration, distance covered, current speed, and elevation gain

### Requirement: Save as Journal activity
The system SHALL save completed recordings as activities on the user's Journal, linked to the active route.

#### Scenario: Save recording
- **WHEN** the user confirms saving after stopping a recording
- **THEN** the GPX track is uploaded to the Journal API as a new activity linked to the route, with distance, duration, and startedAt

#### Scenario: Discard recording
- **WHEN** the user discards a recording
- **THEN** the track data is deleted locally and no activity is created

### Requirement: HealthKit and Health Connect export
The system SHALL export recorded activities to Apple HealthKit (iOS) and Health Connect (Android).

#### Scenario: Export to health platform
- **WHEN** the user saves a recording and has granted health permissions
- **THEN** the activity (distance, duration, route, elevation) is written to HealthKit or Health Connect

#### Scenario: Health permissions not granted
- **WHEN** the user has not granted health permissions
- **THEN** the activity is saved to Journal without health export, and the user can grant permissions later from Profile
