# profile-stats Specification

## Purpose
TBD - created by archiving change profile-stats. Update Purpose after archive.
## Requirements
### Requirement: Lifetime totals on the profile
The profile page SHALL show a stats header with the owner's lifetime totals: activity count, total distance, total ascent, and total elapsed time.

#### Scenario: Totals shown for an athlete with activities
- **WHEN** a user views a profile whose owner has activities
- **THEN** a stats header shows the activity count, total distance, total ascent, and total elapsed time

#### Scenario: Header hidden when there are none
- **WHEN** the profile owner has no activities the viewer may see
- **THEN** no stats header is shown

### Requirement: Viewer-scoped roll-ups
The roll-up SHALL count only the activities the viewer is permitted to see: public-only for other viewers, and all of the owner's activities when the owner views their own profile.

#### Scenario: Visitor sees public-only totals
- **WHEN** a visitor (not the owner) views a profile
- **THEN** the totals aggregate only the owner's public activities (unlisted and private are excluded)

#### Scenario: Owner sees their full totals
- **WHEN** the owner views their own profile
- **THEN** the totals aggregate all of the owner's activities regardless of visibility

### Requirement: Recent-activity summary
The stats header SHALL show the count of activities in the last 4 weeks (rolling), under the same viewer scoping as the totals.

#### Scenario: Last-4-weeks count
- **WHEN** the stats header is shown
- **THEN** it includes the number of the owner's (viewer-scoped) activities started in the last 28 days

### Requirement: Localized stat labels
The stats header SHALL render its labels and units through localized strings.

#### Scenario: German labels
- **WHEN** the UI locale is German
- **THEN** the stat labels render in German

