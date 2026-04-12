## MODIFIED Requirements

### Requirement: Planner E2E test infrastructure
The Planner E2E test suite SHALL mock BRouter by default, split tests by feature file, and provide shared test helpers for common setup patterns.

#### Scenario: BRouter mocked by default
- **WHEN** a Planner E2E test runs
- **THEN** BRouter is mocked via a shared Playwright fixture unless the test explicitly opts into the real BRouter endpoint

#### Scenario: Tests split by feature file
- **WHEN** the Planner E2E test suite is executed
- **THEN** tests are organized into focused files by feature area (session, routing, multi-day, overlays, coloring) instead of a single monolithic test file

#### Scenario: Shared test helpers
- **WHEN** a Planner E2E test needs to create a session and wait for connection
- **THEN** it uses a shared helper function that handles session creation, navigation, and waiting for the connected state
