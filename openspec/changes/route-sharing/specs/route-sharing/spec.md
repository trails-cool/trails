## ADDED Requirements

### Requirement: Route visibility
Routes and activities SHALL support private (default) and public visibility levels.

#### Scenario: Set route public
- **WHEN** a route owner toggles visibility to "public"
- **THEN** the route is viewable by anyone with the link

#### Scenario: Default private
- **WHEN** a new route is created
- **THEN** its visibility is "private" (owner-only)

### Requirement: Per-user route sharing
Route owners SHALL be able to share routes with specific users at view or edit permission levels.

#### Scenario: Share with user
- **WHEN** a route owner shares a route with another user at "view" level
- **THEN** the shared user sees the route in their collection and can view it

#### Scenario: Edit permission
- **WHEN** a route owner shares a route with "edit" permission
- **THEN** the shared user can update the route name, description, and GPX

### Requirement: Route forking
Logged-in users SHALL be able to fork any public route into their own collection.

#### Scenario: Fork public route
- **WHEN** a user clicks "Fork" on a public route
- **THEN** a copy of the route metadata and latest GPX is created in their collection
- **AND** a `forkedFromId` link references the original route

### Requirement: Contributor tracking
Route versions SHALL record the identity of the contributor who saved them.

#### Scenario: Planner callback contributor
- **WHEN** the Planner saves back to the Journal via JWT callback
- **THEN** the contributor's identity is recorded on the new route version
