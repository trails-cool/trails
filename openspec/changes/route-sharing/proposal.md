## Why

Routes in the Journal are currently invisible to everyone except the owner. There
is no way to make a route public, share it with a specific person, or fork
someone else's route into your own collection. The architecture doc specifies
visibility levels, a permission matrix, and forking for Phase 2, and the original
`route-features` spec bundled these with spatial search, multi-day routes, and
photos. This change breaks out the sharing and permissions scope into a focused,
independent unit of work.

Without visibility and sharing, routes are just private GPX storage. Users cannot
show a planned bikepacking route to a friend, let a co-planner view the latest
version in the Journal, or build on someone else's published route. This is the
minimum social layer needed before federation makes routes visible across
instances.

## What Changes

- **Route visibility**: `private` (default) and `public` on routes and
  activities. Public routes are viewable by anyone with the link. Private routes
  are owner-only.
- **Route sharing**: Owners can share a route with specific users at `view` or
  `edit` permission level. Shared users see the route in their collection and can
  act according to their permission.
- **Route forking**: Logged-in users can fork any public route, copying the route
  metadata and latest GPX into their own collection with a `forkedFromId` link
  back to the original.
- **Contributor tracking**: When the Planner saves back to the Journal via JWT
  callback, the contributor's identity is recorded on the route version. The
  route detail page shows who contributed to each version.

These are all Journal-side changes (database schema, server logic, and UI). No
Planner changes are needed.

## Capabilities

### New Capabilities

- `route-sharing`: Visibility levels (private/public), per-user sharing with
  view/edit permissions, share dialog with user search
- `route-forking`: Copy public routes into own collection with provenance link

### Modified Capabilities

- `route-management`: Visibility toggle on routes and activities, permission
  checks on all route access, contributor display
- `planner-callback`: JWT callback records contributor identity on route versions

## Non-Goals

- **Granular permissions beyond view/edit**: No "edit waypoints but not
  description" or "view but not export GPX". Two levels are enough.
- **Team or organization sharing**: No group-level permissions. Share with
  individual users only.
- **ActivityPub federation of shares**: Sharing is local to the instance for now.
  Cross-instance sharing comes with the federation change.
- **Followers-only visibility**: Only private and public for now. A
  followers-only level can be added when the follow system exists.
- **Spatial search / explore page**: Broken out as a separate change. Public
  routes are a prerequisite; discovery is not.

## Impact

- **Database**: New `visibility` enum column on `journal.routes` and
  `journal.activities`. New `journal.route_shares` table. New `contributors`
  text array on `journal.route_versions`. New `forkedFromId` column on
  `journal.routes`.
- **Server logic**: New `permissions.server.ts` module with `canView` and
  `canEdit` functions. Route loaders and list queries updated to respect
  permissions.
- **UI**: Visibility toggle on route detail/edit page. Share dialog modal with
  user search. Fork button on public routes. "Forked from" link. Contributor
  list on route detail.
- **Privacy**: Privacy manifest updated to document visibility and sharing
  behavior.
- **i18n**: New translation keys for visibility, sharing, forking, contributors
  (en + de).
