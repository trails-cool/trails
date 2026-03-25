## ADDED Requirements

### Requirement: Create activity
The Journal SHALL allow authenticated users to create an activity by uploading a GPX trace and adding a description.

#### Scenario: Create activity with GPX
- **WHEN** a user uploads a GPX file and enters a description
- **THEN** an activity is created with the GPS trace, computed distance and duration, and stored in the database

#### Scenario: Create activity linked to route
- **WHEN** a user creates an activity and selects an existing route
- **THEN** the activity is linked to that route (route_id foreign key)

### Requirement: Activity feed
The Journal SHALL display a chronological feed of the authenticated user's activities.

#### Scenario: View own activity feed
- **WHEN** a logged-in user navigates to their feed
- **THEN** they see their activities in reverse chronological order with name, date, distance, and duration

### Requirement: Activity detail page
The Journal SHALL display an activity detail page with map, stats, and description.

#### Scenario: View activity detail
- **WHEN** a user navigates to an activity URL
- **THEN** they see the activity name, description, a map with the GPS trace, distance, duration, and elevation stats

### Requirement: Link activity to route
Users SHALL be able to link an existing activity to a route, or create a route from an activity trace.

#### Scenario: Link activity to existing route
- **WHEN** a user selects "Link to Route" on an activity and chooses a route
- **THEN** the activity's route_id is set to the selected route

#### Scenario: Create route from activity
- **WHEN** a user selects "Create Route from Activity"
- **THEN** a new route is created using the activity's GPX trace

### Requirement: Activity without route
Activities SHALL be allowed to exist without a linked route.

#### Scenario: Standalone activity
- **WHEN** a user imports a GPX activity without linking to a route
- **THEN** the activity is stored with route_id as null
