## ADDED Requirements

### Requirement: Changelog listing page
The system SHALL provide a public `/changelog` page showing all entries newest-first.

#### Scenario: View changelog
- **WHEN** a user visits `/changelog`
- **THEN** all changelog entries are listed with date, title, and preview text

### Requirement: Individual entry pages
Each changelog entry SHALL have a shareable page at `/changelog/:date`.

#### Scenario: View single entry
- **WHEN** a user visits `/changelog/2026-03-25`
- **THEN** the full markdown content of that entry is rendered

#### Scenario: Social sharing meta
- **WHEN** a changelog entry page is loaded
- **THEN** Open Graph meta tags are set (og:title, og:description, og:url)

### Requirement: Markdown file authoring
Changelog entries SHALL be authored as markdown files with YAML frontmatter in the repository.

#### Scenario: Add new entry
- **WHEN** a developer adds a `.md` file to the changelog directory with date frontmatter
- **THEN** it appears on the changelog page after the next deploy

### Requirement: What's New indicator
The system SHALL show a visual indicator when there are changelog entries the user hasn't seen.

#### Scenario: New entry available
- **WHEN** a user visits the app and a changelog entry is newer than their last visit to /changelog
- **THEN** a dot or badge appears on the "Changelog" nav link

#### Scenario: Indicator dismissed
- **WHEN** a user visits the /changelog page
- **THEN** the indicator is dismissed (localStorage timestamp updated)
