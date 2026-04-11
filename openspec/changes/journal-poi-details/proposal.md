## Why

Waypoints snapped to POIs in the Planner store OSM metadata (osmId, phone, address, website, opening hours) on the Yjs Y.Map. This data travels through GPX export and Journal save but is never displayed. When planning a multi-day bike tour, seeing campsite contact details, water point locations, or bike shop opening hours on the Journal route detail page would be valuable.

## What Changes

- **GPX export with POI metadata**: Include osmId and key tags as GPX waypoint extensions so they survive the GPX roundtrip
- **Journal route detail**: Show POI details (phone, address, website, opening hours) for waypoints that have POI metadata
- **Journal waypoint list**: Display POI icons and names alongside waypoint coordinates

## Capabilities

### Modified Capabilities
- `gpx-export`: Waypoint extensions for POI metadata
- `journal-route-detail`: POI details display for waypoints
- `route-management`: Store and retrieve POI metadata

## Impact

- `packages/gpx/src/generate.ts`: Add GPX extensions for POI tags
- `packages/gpx/src/parse.ts`: Parse POI extensions back
- `apps/journal/app/routes/routes.$id.tsx`: Display POI details per waypoint
- `@trails-cool/types`: Extend Waypoint type with optional POI fields
