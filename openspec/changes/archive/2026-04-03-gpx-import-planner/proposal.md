## Why

The planner has no UI for importing GPX files directly. Users can only get routes into the planner via URL parameters (`/new?gpx=...`) or the journal's "Edit in Planner" handoff. There's no way to open a local GPX file from the planner itself — a basic expectation for any route planning tool.

## What Changes

- Add a GPX file upload button to the planner home page and session header
- When a GPX file is uploaded, create a new session with waypoints extracted from the track (via Douglas-Peucker) and no-go areas from extensions
- Support drag-and-drop of GPX files onto the map
- Reuse existing `parseGpxAsync`, `extractWaypoints`, and no-go area parsing infrastructure

## Capabilities

### New Capabilities
- `gpx-import`: GPX file import UI in the planner (upload button, drag-and-drop, file parsing, session creation)

### Modified Capabilities
- `planner-session`: Session can now be initialized from a GPX file upload (not just URL params)
- `planner-journal-handoff`: The "Export Plan" → reimport flow is now a first-class UI action

## Impact

- `apps/planner/app/routes/home.tsx` — add upload button
- `apps/planner/app/components/PlannerMap.tsx` — drag-and-drop zone
- `apps/planner/app/routes/new.tsx` — handle file upload POST
- `packages/i18n/src/locales/` — new translation keys
- `e2e/planner.test.ts` — new E2E tests for file import
