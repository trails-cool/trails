## ADDED Requirements

### Requirement: BLE nearby route sync
The mobile app SHALL discover nearby devices via Bluetooth LE and transfer route data (waypoints + GPX geometry) directly between devices without internet connectivity.

#### Scenario: BLE device discovery
- **WHEN** a user enables nearby sync on the route detail screen
- **THEN** the app advertises via BLE and discovers other nearby devices that have the same route open

#### Scenario: Route transfer
- **WHEN** a nearby device with a newer version of the route is discovered
- **THEN** the user is prompted to accept the update and the route data is transferred via chunked BLE messages

#### Scenario: Version check before sync
- **WHEN** two devices discover each other via BLE
- **THEN** they exchange route version numbers and only the device with the older version is offered the update

### Requirement: QR waypoint sharing
The mobile app SHALL support sharing waypoint coordinates via QR code as a fallback when BLE is unavailable or impractical.

#### Scenario: QR waypoint sharing
- **WHEN** a user taps "Share via QR" on a route
- **THEN** a QR code is generated containing compressed waypoint coordinates that another device can scan to receive the waypoints
