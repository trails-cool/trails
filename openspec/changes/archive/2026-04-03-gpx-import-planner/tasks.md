## 1. Home Page Import

- [x] 1.1 Add "Import GPX" button next to "Start Planning" on the planner home page
- [x] 1.2 Add hidden file input (`accept=".gpx"`) triggered by the button
- [x] 1.3 On file select: parse GPX client-side with `parseGpxAsync`, extract waypoints and no-go areas
- [x] 1.4 POST extracted data to `/api/sessions`, redirect to new session with waypoints + no-go areas in URL params
- [x] 1.5 Show error toast if GPX parsing fails

## 2. Drag-and-Drop Import

- [x] 2.1 Add drag-and-drop zone to `PlannerMap` (listen for `dragenter`, `dragover`, `drop` on map container)
- [x] 2.2 Show visual overlay when a file is dragged over the map ("Drop GPX file here")
- [x] 2.3 On drop: validate file extension is `.gpx`, reject others with error toast
- [x] 2.4 Parse dropped GPX file client-side
- [x] 2.5 Show confirmation dialog ("Replace current route with imported GPX?")
- [x] 2.6 On confirm: replace Yjs waypoints and no-go areas with imported data in a single transaction

## 3. i18n

- [x] 3.1 Add translation keys for import UI text (en + de): button label, drop zone text, confirmation dialog, error messages

## 4. Testing

### Unit tests
- [x] 4.1 Test GPX file parsing and waypoint extraction from File object (mock FileReader)

### E2E tests
- [x] 4.2 Home page import: upload GPX file via file input → session created with waypoints
- [x] 4.3 Drag-and-drop: drop GPX on map → waypoints replaced (Playwright file drop)
- [x] 4.4 Invalid file: upload non-GPX → error toast shown, no session created
- [x] 4.5 Plan round-trip: export plan → reimport via upload → waypoints and no-go areas match
