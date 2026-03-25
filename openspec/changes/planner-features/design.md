## Context

The Planner architecture defines noGoAreas, notes, and crash recovery in the
Yjs data model but none are implemented. The public instance also lacks rate
limiting — anyone can create unlimited sessions or hammer BRouter.

## Goals / Non-Goals

**Goals:**
- Draw no-go polygons on the map, synced via Yjs, sent to BRouter
- Shared notes (Y.Text) visible in sidebar for planning discussion
- localStorage backup of Yjs state, merged on reconnect
- Rate limits: 10 sessions/IP/hour, 60 BRouter calls/session/hour

**Non-Goals:**
- Complex polygon editing (holes, multi-polygon) — just simple polygons
- Rich text in notes (just plain text)
- Cross-tab Yjs sync via localStorage (handled by WebSocket)
- Rate limiting dashboard or admin UI

## Decisions

### D1: No-go areas as Yjs Y.Array of polygon coordinates

```typescript
// Yjs doc structure addition
noGoAreas: Y.Array<Y.Map<{
  points: Array<{lat: number, lon: number}>,
  name?: string
}>>
```

Each polygon is a closed ring of lat/lon points. BRouter accepts no-go areas
as a `nogo` parameter: `lon,lat,radius` for circles or polygon coordinates
depending on the BRouter version. We'll convert our polygons to BRouter's
expected format in the routing request.

### D2: Leaflet.draw for polygon drawing

Use `leaflet-draw` (or `@geoman-io/leaflet-geoman-free`) for drawing polygons
on the map. When a polygon is completed, add it to the Y.Array. Existing
polygons render as semi-transparent red overlays.

### D3: Notes as Y.Text in sidebar tab

Add a "Notes" tab to the sidebar (alongside waypoints). Uses Y.Text for
collaborative editing — simple textarea bound to Y.Text. Changes sync in
real-time. No markdown rendering — plain text only.

### D4: localStorage crash recovery

Every 10 seconds, save `Y.encodeStateAsUpdate(doc)` to
`localStorage['trails:session:${id}']`. On page load, if localStorage has
state for the current session, apply it as an update before connecting to
the server. Yjs CRDTs merge automatically — no conflicts.

Clear localStorage entry when session is closed or after successful sync.

### D5: In-memory rate limiter

Simple Map-based rate limiter in `server.ts`:
- Session creation: Track IP → count + window. Reject with 429 after 10/hour.
- BRouter proxy: Track session ID → count + window. Reject after 60/hour.
- No Redis needed — single server, in-memory is fine. Resets on restart
  (acceptable).

## Risks / Trade-offs

- **leaflet-draw adds bundle size** → ~50KB gzipped. Acceptable for polygon
  drawing functionality. Can lazy-load.
- **localStorage size limit** → ~5MB per origin. Yjs state is typically
  10-100KB. No risk.
- **In-memory rate limiter resets on deploy** → Acceptable for current scale.
  Redis-backed when needed.
