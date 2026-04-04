## MODIFIED Requirements

### Requirement: Map components used in journal app
The `@trails-cool/map` package's `MapView` and `RouteLayer` components SHALL be used in the journal app for route previews, in addition to the planner.

#### Scenario: Journal uses shared map components
- **WHEN** the journal renders a route map preview or detail map
- **THEN** it uses `MapView` and `RouteLayer` from `@trails-cool/map`
- **AND** no map code is duplicated between planner and journal
