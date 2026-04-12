## ADDED Requirements

### Requirement: Download routes for offline
The system SHALL allow users to download route data (GPX, waypoints, metadata) for offline access.

#### Scenario: Download a route
- **WHEN** the user taps "Download for offline" on a route
- **THEN** the route GPX, parsed waypoints, and metadata are stored in the local SQLite database

#### Scenario: View offline route
- **WHEN** the user views a downloaded route without network connectivity
- **THEN** the route is loaded from the local database and displayed on the map with cached tiles

#### Scenario: Delete offline data
- **WHEN** the user removes a route from offline storage
- **THEN** all cached data for that route (GPX, tiles, metadata) is deleted from the device

### Requirement: Map tile caching
The system SHALL cache map tiles for downloaded route regions so maps are viewable offline.

#### Scenario: Tile download for route region
- **WHEN** a route is downloaded for offline use
- **THEN** map tiles covering the route bounding box at relevant zoom levels are cached locally

#### Scenario: Storage budget
- **WHEN** the total offline storage exceeds the configured budget (shown on Profile tab)
- **THEN** the system warns the user and suggests removing older offline routes

### Requirement: Offline edit queue
The system SHALL queue route edits made offline and sync them when connectivity returns.

#### Scenario: Queue edits while offline
- **WHEN** the user edits a route without network connectivity
- **THEN** the changes are saved to a local edit queue and a sync-pending indicator is shown

#### Scenario: Sync on reconnect
- **WHEN** the device regains network connectivity
- **THEN** queued edits are sent to the Journal API in order and the sync indicator clears

#### Scenario: Conflict on sync
- **WHEN** the server version of a route changed while the user was offline
- **THEN** the system warns the user and applies last-write-wins, preserving the local version
