## MODIFIED Requirements

### Requirement: Deep link from mobile to Planner
The system SHALL allow the mobile app to open the Planner web app for full collaborative editing of a route.

#### Scenario: Open in Planner from mobile
- **WHEN** the user taps "Edit in Planner" on a route in the mobile app
- **THEN** the device browser opens the Planner with the route loaded and a JWT callback URL for saving back to the Journal

#### Scenario: Return to mobile after Planner save
- **WHEN** the user saves a route in the Planner web session that was opened from the mobile app
- **THEN** the Planner triggers a deep link back to the mobile app, which refreshes the route to show the updated version

#### Scenario: Planner session without save
- **WHEN** the user returns to the mobile app without saving in the Planner
- **THEN** the mobile app shows the route unchanged (no stale data)
