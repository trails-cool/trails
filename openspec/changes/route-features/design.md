## Context

The architecture doc defines a rich route model with permissions, multi-day
support, spatial queries, and photos. Currently routes are owner-only, flat
(no days), and have no photos or spatial search. This change adds the route
and activity features needed before federation makes them visible to others.

## Goals / Non-Goals

**Goals:**
- Route visibility (private/public) and sharing with specific users
- Fork public routes
- Multi-day route support with day-break waypoints
- Map-based route discovery via PostGIS
- Photo attachments on activities
- Contributor tracking on route versions

**Non-Goals:**
- Federation of routes (separate change)
- Real-time collaborative permission changes
- Photo editing or filters
- Route recommendations based on preferences
- Activity collections (multi-day trip grouping — future)

## Decisions

### D1: Visibility as enum column on routes and activities

Add `visibility` column (`public`, `private`, default `private`) to both
routes and activities. `followers_only` added later when following exists.
Public routes appear in spatial search. Private routes are owner-only.

### D2: Route shares table for explicit sharing

```
journal.route_shares (routeId, userId, permission: 'view' | 'edit')
```

Owner can share with specific users. Shared users see the route in their
"Shared with me" section. Edit permission allows starting Planner sessions.

### D3: Day breaks as waypoint property

The Planner's Yjs waypoint Y.Map gets an optional `isDayBreak: true` field.
The sidebar and elevation chart show day boundaries. GPX export uses one
track segment per day. The Journal stores day-break indices in route metadata.

### D4: PostGIS spatial search

Routes already store geometry as PostGIS LineString. Add a `/routes/explore`
page with a map — as the user pans/zooms, query public routes within the
bounding box using `ST_Intersects`. Show route previews on the map.

### D5: Photo storage via S3 (Garage)

Use the Garage S3-compatible storage already in the architecture. Upload flow:
server generates presigned PUT URL → client uploads directly to S3 → server
stores the S3 key in a `journal.activity_photos` table. Serve via presigned
GET URLs or a CDN path.

### D6: Contributor tracking via array column

Add `contributors` text array to `journal.route_versions`. When a Planner
session saves back via callback, the JWT identifies the actor. The version
records the contributor's user ID (or ActivityPub URI for future federation).

## Risks / Trade-offs

- **S3 setup required** → Garage needs to be enabled in docker-compose (currently commented out). Adds operational complexity.
- **Spatial search performance** → PostGIS bounding box queries are fast with spatial indexes. Already have the geometry column.
- **Multi-day in Planner requires Yjs changes** → Adding `isDayBreak` to waypoints is backward-compatible (optional field). Existing sessions unaffected.
