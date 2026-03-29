## ADDED Requirements

### Requirement: Route visibility levels
Routes SHALL have a visibility setting controlling who can see them.

#### Scenario: Private route
- **WHEN** a route's visibility is "private"
- **THEN** only the owner can view it

#### Scenario: Public route
- **WHEN** a route's visibility is "public"
- **THEN** anyone can view it and export its GPX

### Requirement: Share routes with specific users
Route owners SHALL be able to share routes with specific users at view or edit permission levels.

#### Scenario: Share with view access
- **WHEN** owner shares a route with another user as "view"
- **THEN** that user can see the route and export GPX but cannot edit

#### Scenario: Share with edit access
- **WHEN** owner shares a route with another user as "edit"
- **THEN** that user can start Planner sessions and create new versions

### Requirement: Fork routes
Users SHALL be able to fork (copy) public routes to their own collection.

#### Scenario: Fork a public route
- **WHEN** a user clicks "Fork" on a public route
- **THEN** a copy is created in their collection with the original credited
