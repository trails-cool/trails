## MODIFIED Requirements

### Requirement: View route
The Journal SHALL display route details including map, metadata, and elevation stats. Access depends on the route's `visibility`: `public` routes are viewable by anyone including unauthenticated visitors, `unlisted` routes are viewable by anyone who has the URL, and `private` routes are viewable only by the owner.

#### Scenario: Owner views own route
- **WHEN** a logged-in user navigates to a route they own at any visibility
- **THEN** they see the route name, description, a map with the route polyline, distance, and elevation gain/loss

#### Scenario: Anyone views a public route
- **WHEN** any visitor (including unauthenticated) navigates to a `public` route's URL
- **THEN** they see the full route detail page as above

#### Scenario: Anyone with the URL views an unlisted route
- **WHEN** any visitor navigates directly to an `unlisted` route's URL
- **THEN** they see the full route detail page as above

#### Scenario: Non-owner is blocked from a private route
- **WHEN** a visitor who is not the owner requests a `private` route URL
- **THEN** the server responds with HTTP 404 (not 403), so the existence of the private route is not leaked

#### Scenario: Public and unlisted route pages emit social-share metadata
- **WHEN** a visitor loads a `public` or `unlisted` route detail page
- **THEN** the response emits Open Graph and Twitter Card meta tags (`og:title`, `og:description`, `og:type="article"`, `og:site_name`, `twitter:card="summary"`)

## ADDED Requirements

### Requirement: Route visibility
The Journal SHALL persist a `visibility` value on every route and SHALL allow the owner to change it.

#### Scenario: New routes default to private
- **WHEN** a route is created without an explicit visibility
- **THEN** the route row is persisted with `visibility = 'private'`

#### Scenario: Owner changes a route's visibility
- **WHEN** a route owner selects a different visibility (`private`, `unlisted`, `public`) in the edit flow and saves
- **THEN** the stored visibility is updated and subsequent access checks use the new value immediately

#### Scenario: Non-owner cannot change visibility
- **WHEN** a request to update visibility arrives from a user who is not the route owner
- **THEN** the server rejects it with HTTP 403 or 404 (matching the current update-route behaviour), and the stored value is unchanged

### Requirement: Route listings respect visibility
Any listing that exposes routes beyond the owner's own dashboard SHALL only include routes with `visibility = 'public'`.

#### Scenario: Public profile lists only public routes
- **WHEN** a visitor loads `/users/:username`
- **THEN** the rendered list of routes includes only the user's `public` routes; `unlisted` and `private` routes are omitted

#### Scenario: Owner's own routes list is unchanged
- **WHEN** a logged-in user views their own routes list at `/routes`
- **THEN** the list includes all of their own routes regardless of visibility
