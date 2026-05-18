## Why

Waypoints in the Planner are just coordinates with optional names. When planning
a multi-day route, users need to note *why* a waypoint matters: "Water refill at
gas station", "Tricky gravel crossing - dismount", "Campsite with shelter",
"Scenic viewpoint over the valley". Without notes, this context lives outside the
tool (paper, chat messages, memory) and gets lost.

A related problem: waypoints placed by clicking on the map often miss nearby
points of interest by a few meters. A user clicks near a water source, campsite,
or shelter, but the waypoint lands on the road 30 meters away. They have to
manually look up the POI name, type it in, and nudge the waypoint. This is
tedious and error-prone, especially on mobile. POIs give immediate context to
waypoints - the same kind of context that notes provide in free-form text.

## What Changes

- **Per-waypoint text notes**: Each waypoint in the Yjs document gets an optional
  `note` string field. Plain text, no rich formatting.
- **Inline editing in sidebar**: Click the note area under a waypoint name to
  edit. Auto-saves on blur. Placeholder "Add a note..." when empty.
- **Map indicator**: Markers with notes show a small note icon. Hover/tap reveals
  the note in a tooltip.
- **GPX export**: Notes are included as `<desc>` elements in waypoint GPX output.
- **Shared type update**: The `Waypoint` interface in `@trails-cool/types` gets
  an optional `note` field.
- **Nearby POI display**: When a waypoint is selected, query nearby POIs from
  OpenStreetMap (via Overpass API) and show them as small markers on the map and
  as a list in the sidebar.
- **Snap to POI**: Click a nearby POI to move the waypoint to its exact
  coordinates, inheriting the POI's name and type as a note prefix (e.g.,
  "⛺ Campsite - Waldcamp Fichtelberg"). The user can edit after snapping.

## Capabilities

### New Capabilities

- `waypoint-notes`: Per-waypoint text notes with inline editing, map indicators,
  and GPX export
- `poi-snapping`: Nearby POI lookup via Overpass API with snap-to-POI interaction
  on map and sidebar

### Modified Capabilities

- `planner-session`: Waypoint Y.Map objects gain a `note` string field
- `gpx-export`: Waypoint `<desc>` element populated from notes
- `shared-types`: `Waypoint` interface extended with optional `note`
- `planner-map`: POI markers shown near selected waypoint, click to snap

## Non-Goals

- Rich text (bold, links, images) - plain text only
- Comments from other users - notes belong to the waypoint, not a thread
- Note history or versioning beyond what Yjs provides
- Markdown rendering
- Full OSM data overlay across the entire map (separate feature)
- POI search or filtering across the whole map viewport
- Custom POI database - we use OpenStreetMap data exclusively
- Offline POI data - requires network access to Overpass API

## Impact

- **Yjs schema**: New `note` string key on waypoint Y.Map (backward compatible -
  old clients ignore unknown keys)
- **Shared types**: `Waypoint.note?: string` added to `@trails-cool/types`
- **GPX package**: `generateGpx` writes `<desc>` when waypoint has a note
- **Sidebar**: Inline note display and editing below waypoint name; POI list
  under selected waypoint with snap buttons
- **Map markers**: Note indicator icon and tooltip; POI markers near selected
  waypoint
- **New Overpass API client**: Fetches nearby POIs for a given coordinate,
  with caching and rate limiting
- **i18n**: New translation keys for note placeholder, labels, POI types,
  and snap actions (en + de)
- **No database changes**: Planner is stateless, all state lives in Yjs. POI
  cache is ephemeral (in-memory, not persisted)
