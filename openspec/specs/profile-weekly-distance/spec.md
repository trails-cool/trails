# profile-weekly-distance Specification

## Purpose
TBD - created by archiving change profile-weekly-distance. Update Purpose after archive.
## Requirements
### Requirement: Weekly distance chart on the profile
The profile page SHALL show a weekly-distance bar chart beneath the stats header, with one bar per week for the last 12 weeks and bar heights normalized to the busiest week in the window.

#### Scenario: Chart shown when there is recent distance
- **WHEN** a user views a profile whose owner has distance in the last 12 weeks
- **THEN** a 12-week bar chart is shown, the tallest bar being the week with the most distance

#### Scenario: Chart hidden without recent distance
- **WHEN** the owner has no (viewer-visible) distance in the last 12 weeks
- **THEN** no weekly chart is shown

### Requirement: Contiguous weekly axis
The chart SHALL render a contiguous run of weeks, including weeks with no activity as zero-height bars, so the axis is stable.

#### Scenario: Empty weeks appear as gaps
- **WHEN** the owner was active in some weeks of the window but not others
- **THEN** the inactive weeks render as zero-height bars in their correct position (not omitted)

### Requirement: Viewer-scoped weekly distance
The weekly distance SHALL be scoped to what the viewer may see: public-only for other viewers, and all of the owner's activities when the owner views their own profile.

#### Scenario: Visitor sees public-only weeks
- **WHEN** a visitor (not the owner) views a profile
- **THEN** each week's bar reflects only the owner's public activities

### Requirement: Localized chart labels
The chart SHALL render its label and per-bar distance readouts through localized strings.

#### Scenario: German labels
- **WHEN** the UI locale is German
- **THEN** the chart label and distance readouts render in German

