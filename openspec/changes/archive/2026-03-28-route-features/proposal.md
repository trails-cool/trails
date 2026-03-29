## Why

Routes are currently flat — no permissions beyond owner, no way to share with
specific people, no forking, no multi-day support, no spatial discovery, and
no contributor tracking. The architecture doc specifies all of these for Phase
2. Without them, routes are just personal GPX storage with no social or
collaborative dimension.

## What Changes

- **Route sharing permissions**: Private/public/shared visibility levels with
  a view/edit permission matrix
- **Route forking**: Copy someone else's public route to your own collection
- **Multi-day routes**: Day-break waypoints that split a route into stages with
  per-day stats and GPX segments
- **Spatial search**: "Routes near me" or "routes in this area" using PostGIS
- **Contributor tracking**: Record who contributed to each route version
- **Activity visibility levels**: Public/followers-only/private on activities
- **Photo attachments**: Upload photos to activities (requires S3/Garage setup)

## Capabilities

### New Capabilities

- `route-sharing`: Permission model (private/public/shared), view/edit access, route forking
- `spatial-search`: Map-based route discovery using PostGIS bounding box and proximity queries
- `multi-day-routes`: Day-break markers on waypoints, per-day stats, multi-segment GPX export
- `activity-photos`: Photo upload and display on activities via S3-compatible storage

### Modified Capabilities

- `route-management`: Add visibility, contributor tracking, forking
- `activity-feed`: Add visibility levels (public/followers-only/private)
- `planner-session`: Support day-break waypoint markers
- `infrastructure`: S3/Garage setup for photo storage

## Impact

- **Database**: New columns (visibility, contributors) on routes and activities, new route_shares table, photo storage metadata
- **Storage**: S3-compatible object storage (Garage) for photos
- **Files**: Route detail page, activity pages, search page, Planner waypoint UI, sharing UI
- **Dependencies**: S3 client library for photo uploads
- **Privacy**: Photo storage, route visibility controls documented in manifest
