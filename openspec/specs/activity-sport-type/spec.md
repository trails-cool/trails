# activity-sport-type Specification

## Purpose
TBD - created by archiving change activity-sport-type. Update Purpose after archive.
## Requirements
### Requirement: Activity sport type field
An activity SHALL have an optional sport type drawn from a fixed set: `hike`,
`walk`, `run`, `ride`, `gravel`, `mtb`, `ski`, `other`. The field MAY be unset
(unspecified), and an unset value SHALL be valid for any activity.

#### Scenario: Sport type omitted
- **WHEN** an activity is created without a sport type
- **THEN** the activity is stored with no sport type
- **AND** it renders without a sport badge and with a generic feed verb

#### Scenario: Sport type out of range is rejected
- **WHEN** a create or update request supplies a sport type outside the fixed set
- **THEN** the request is rejected by schema validation

### Requirement: Setting sport type on create
The activity create form SHALL offer an optional sport-type selector, and the
chosen value SHALL be persisted with the activity.

#### Scenario: User selects a sport on create
- **WHEN** a user picks "Gravel" in the sport selector and creates the activity
- **THEN** the activity is stored with sport type `gravel`
- **AND** the detail page shows the gravel badge

### Requirement: Sport type normalization on import
The system SHALL normalize a connected service's sport/activity descriptor into the fixed set when importing an activity; descriptors with no confident match SHALL normalize to `other`, and providers that supply no descriptor SHALL leave the sport type unset.

#### Scenario: Komoot tour with a known sport
- **WHEN** a Komoot tour with sport `mountainbike` is imported
- **THEN** the created activity has sport type `mtb`

#### Scenario: Komoot tour with an unrecognized sport
- **WHEN** a Komoot tour with an unrecognized sport string is imported
- **THEN** the created activity has sport type `other`

#### Scenario: Provider without a sport descriptor
- **WHEN** a Garmin activity (no sport in its notification payload) is imported
- **THEN** the created activity has no sport type

### Requirement: Sport type display
The UI SHALL show a set sport type as a badge (icon plus localized label) wherever an activity is presented (detail page, feed card, profile activity list), and the feed verb SHALL reflect the sport; an unset sport type SHALL show no badge.

#### Scenario: Badge on the detail page
- **WHEN** a user views an activity whose sport type is `hike`
- **THEN** a hike badge with a localized label appears next to the title

#### Scenario: Sport-aware feed verb
- **WHEN** an activity with sport type `run` appears in the feed
- **THEN** the card phrasing reflects running (e.g. "went for a run")

#### Scenario: Localized label
- **WHEN** the UI locale is German
- **THEN** the sport badge label is rendered in German

### Requirement: Sport type federation
The ActivityPub serializer SHALL include a set sport type as an attachment when serializing an activity, without altering the existing object shape.

#### Scenario: Sport included in the Note
- **WHEN** an activity with sport type `ride` is federated as a Note
- **THEN** the Note carries a `sport` property value of `ride`
- **AND** the previously-emitted properties (distance, duration, elevation) are unchanged

