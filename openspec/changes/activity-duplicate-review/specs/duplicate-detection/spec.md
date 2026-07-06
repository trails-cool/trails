## ADDED Requirements

### Requirement: Cross-source duplicate detection on import
When an activity is created via any import path (provider sync, manual GPX upload, Komoot), the Journal SHALL check for an existing activity of the same owner whose start time is within 120 seconds and, when both durations are known, whose time interval overlaps at least 70%. On a match, the new activity SHALL be stored with a reference to the suspected original rather than discarded. Activities without a start time SHALL never be flagged.

#### Scenario: Same ride from two providers
- **WHEN** a Wahoo import created an activity and a Garmin backfill delivers the same ride starting 30 seconds apart
- **THEN** the second activity is stored flagged as a suspected duplicate of the first

#### Scenario: Back-to-back repeats are not duplicates
- **WHEN** two activities start 90 seconds apart but the first lasts only 1 minute (intervals barely overlap)
- **THEN** neither is flagged

### Requirement: Quarantine until resolved
A suspected-duplicate activity SHALL be excluded from feeds, listings, profile statistics, the public API, follower notifications, and federation until resolved. The owner SHALL still be able to open it; other users SHALL NOT.

#### Scenario: Stats not double-counted
- **WHEN** a suspected duplicate exists
- **THEN** weekly distance and profile stats count the original only

#### Scenario: Not federated while quarantined
- **WHEN** an activity is flagged
- **THEN** no ActivityPub Create is emitted for it

### Requirement: Owner notification and review
The owner SHALL receive a "possible duplicate import" notification linking to a review surface that shows both activities' source, start time, duration, and distance, offering **keep both** (clears the flag; the activity publishes with its original visibility, including federation) and **discard** (deletes the flagged copy while keeping the provider import record so it is not re-imported).

#### Scenario: Keep both
- **WHEN** the owner chooses keep both
- **THEN** the flag is cleared and the activity appears in feeds/stats and federates normally

#### Scenario: Discard
- **WHEN** the owner chooses discard
- **THEN** the flagged activity is deleted, the original is untouched, and a provider re-sync does not recreate it

### Requirement: Import batch reporting
Import batches SHALL count suspected duplicates separately from exact same-provider duplicates.

#### Scenario: Batch summary distinguishes
- **WHEN** a backfill imports 10 activities of which 2 match existing Wahoo activities by time overlap
- **THEN** the batch reports 2 suspected duplicates distinct from exact-ID skips
