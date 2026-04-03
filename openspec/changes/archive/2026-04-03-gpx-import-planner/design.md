## Context

The planner currently receives GPX data only via URL parameters or the journal API. All GPX parsing infrastructure exists (`parseGpxAsync`, `extractWaypoints`, no-go area parsing) but there's no user-facing file upload. Users expect to open a local GPX file directly — standard in every route planning tool.

## Goals / Non-Goals

**Goals:**
- Let users import a GPX file from the planner home page to start a new session
- Let users import a GPX file into an existing session (replacing current waypoints)
- Support drag-and-drop onto the map as an alternative to the file picker
- Reuse existing GPX parsing, waypoint extraction, and no-go area infrastructure

**Non-Goals:**
- Importing non-GPX formats (KML, GeoJSON, FIT) — future work
- Merging imported GPX with existing session data — import replaces
- Server-side file storage — GPX is parsed client-side, only waypoints/no-go areas are stored in Yjs

## Decisions

**Client-side parsing:** Parse GPX in the browser using `parseGpxAsync` (which uses native `DOMParser`). No need to upload the file to the server. Extract waypoints and no-go areas, then initialize the Yjs session.

**Two entry points:**
1. **Home page:** Upload button next to "Start Planning". Creates a new session with the imported data.
2. **Session map:** Drag-and-drop onto the map. Replaces current waypoints and no-go areas after confirmation.

**Session creation flow (home page):** POST the parsed waypoints and no-go areas to `/api/sessions` (same as the journal handoff), then redirect to the new session URL with data in query params.

**In-session import (drag-and-drop):** Parse client-side, confirm replacement, then update Yjs arrays directly. No server round-trip needed.

## Risks / Trade-offs

- **Large GPX files:** Douglas-Peucker runs client-side. Files with 100K+ points may be slow. Acceptable for v1 — optimize later if needed.
- **Replacing vs merging:** Import replaces all waypoints/no-go areas. Users might expect to add to existing data. A confirmation dialog mitigates accidental loss.
