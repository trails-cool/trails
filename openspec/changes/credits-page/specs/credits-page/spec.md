## ADDED Requirements

### Requirement: Credits page
The Journal SHALL serve a credits page at `/about/credits` with three sections — inspirations (linked projects with a one-line acknowledgment each, matching the list in `docs/philosophy.md`), data attributions (including "© OpenStreetMap contributors" per ODbL guidelines and, once shipped, GeoNames CC-BY), and key open-source components. All strings SHALL be localized.

#### Scenario: Page renders with inspirations
- **WHEN** a user (authenticated or not) opens `/about/credits`
- **THEN** the page lists BRouter, bikerouter.de, brouter-web, Organic Maps, Endurain, and wanderer with links and acknowledgment lines

#### Scenario: Localized content
- **WHEN** the UI locale is German
- **THEN** headings and acknowledgment lines render in German

#### Scenario: OSM attribution wording
- **WHEN** the data section renders
- **THEN** it contains the canonical "© OpenStreetMap contributors" attribution with a link to the OSM copyright page
