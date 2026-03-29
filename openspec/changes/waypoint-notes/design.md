## Context

The Planner stores waypoints as a `Y.Array<Y.Map<unknown>>` with `lat`, `lon`,
and optional `name` keys. The visual-redesign mockup (D4, D5) already shows
waypoint notes as italic text under the waypoint name in the sidebar, and a note
icon on map markers. This change implements the data model and interaction logic
behind those placeholders.

## Decisions

### D1: Note storage in Yjs

Each waypoint is a `Y.Map` in the `waypoints` Y.Array. Add an optional `note`
key of type `string`. Plain text only, no markup.

```typescript
// Existing keys
yMap.get("lat")   // number
yMap.get("lon")   // number
yMap.get("name")  // string | undefined

// New key
yMap.get("note")  // string | undefined
```

Soft limit of ~500 characters enforced in the UI (character counter, input
truncation) but not in the Yjs document itself. This keeps the data layer simple
and avoids breaking collaborative edits if two users type near the limit
simultaneously.

The `Waypoint` interface in `@trails-cool/types` gets a corresponding optional
field:

```typescript
export interface Waypoint {
  lat: number;
  lon: number;
  name?: string;
  note?: string;       // new
  isDayBreak?: boolean;
}
```

### D2: Editing UX in sidebar

The note appears as italic text below the waypoint name in the sidebar list item.
When empty, a muted placeholder reads "Add a note..." (i18n key:
`planner.waypoint.notePlaceholder`).

Clicking the note text (or placeholder) activates an inline `<textarea>` with:
- Auto-focus on click
- Auto-resize to content height
- Character counter showing remaining chars (e.g., "127 / 500")
- Save on blur (write to Y.Map)
- Cancel on Escape (revert to last saved value)
- No explicit save button - auto-save keeps the interaction lightweight

The textarea uses the same font styling as the display text (italic, --text-md
color) so the transition between view and edit is seamless.

### D3: Map marker note indicator

Waypoint markers that have a non-empty note display a small note icon (a
document/pencil glyph) as a CSS pseudo-element or secondary Leaflet DivIcon
element, positioned at the top-right of the marker.

Hover (desktop) or tap (mobile) on a marker with a note shows a Leaflet tooltip
containing the note text. The tooltip has a max-width of 250px and truncates
after 3 lines with ellipsis for long notes. Clicking "more" in the tooltip
scrolls the sidebar to that waypoint and opens the editor.

### D4: Collaborative editing

Notes are plain strings stored via `yMap.set("note", value)`. Yjs conflict
resolution for Y.Map string values is last-write-wins, which is acceptable for
short text notes. This is the same behavior as waypoint names.

If finer-grained collaborative editing were needed (two users editing the same
note simultaneously), we would use a nested `Y.Text`. That complexity is not
justified for short notes that rarely have concurrent edits. If usage patterns
prove otherwise, upgrading to `Y.Text` is a backward-compatible change.

### D5: GPX export

The `generateGpx` function in `@trails-cool/gpx` includes the note as a `<desc>`
element inside the `<wpt>` element, per GPX 1.1 spec:

```xml
<wpt lat="51.0504" lon="13.7373">
  <name>Dresden Neustadt</name>
  <desc>Water refill at train station</desc>
</wpt>
```

The `<desc>` element is only emitted when the note is non-empty. XML special
characters are escaped via the existing `escapeXml` helper.

GPX import (parsing) should also read `<desc>` into the `note` field when
present, so round-tripping preserves notes.

### D6: Note display styling

Per the visual-redesign D4 mockup, notes render as italic text in `--text-md`
color below the waypoint name in the sidebar. Styling:

```
font-style: italic
color: var(--text-md)   /* #5C5847 */
font-size: 0.8125rem    /* 13px, one step below body 14px */
line-height: 1.3
max-height: 2.6em       /* ~2 lines in display mode */
overflow: hidden
text-overflow: ellipsis
```

When the sidebar is in its current pre-redesign state (before visual-redesign
lands), use equivalent Tailwind classes (`italic text-gray-500 text-xs`).

### D7: POI source - Overpass API

POI data comes from the Overpass API, which provides read access to OpenStreetMap
data. When a waypoint is selected in the sidebar, we query for amenity, tourism,
and natural nodes within a radius of the waypoint.

Query strategy:
- Endpoint: `https://overpass-api.de/api/interpreter` (public instance)
- Query type: `node` elements within a bounding box derived from the waypoint
  coordinates +/- ~500m (~0.0045 degrees latitude, adjusted for longitude)
- Filter by relevant tags (see D8 for POI types)
- Return compact JSON format (`[out:json]`)

Example query skeleton:

```
[out:json][timeout:10];
(
  node["amenity"~"drinking_water|water_point|shelter|restaurant|cafe|fast_food"]({{bbox}});
  node["tourism"~"camp_site|camp_pitch|alpine_hut|wilderness_hut|viewpoint"]({{bbox}});
  node["natural"="spring"]({{bbox}});
  node["amenity"="bicycle_parking"]({{bbox}});
  node["amenity"="bicycle_repair_station"]({{bbox}});
);
out body;
```

The query runs client-side from the browser (no server proxy needed). The
Overpass API supports CORS.

### D8: POI types

POIs are categorized by type, each with an icon and OSM tag mapping. The set of
displayed types depends on the active routing profile.

| Category | OSM Tags | Icon | Profiles |
|----------|----------|------|----------|
| Water | `amenity=drinking_water`, `amenity=water_point`, `natural=spring` | 💧 | all |
| Shelter | `tourism=alpine_hut`, `tourism=wilderness_hut`, `amenity=shelter` | 🏠 | all |
| Camping | `tourism=camp_site`, `tourism=camp_pitch` | ⛺ | all |
| Food | `amenity=restaurant`, `amenity=cafe`, `amenity=fast_food` | 🍴 | all |
| Viewpoint | `tourism=viewpoint` | 👁 | all |
| Bicycle | `amenity=bicycle_parking`, `amenity=bicycle_repair_station` | 🔧 | trekking, fastbike |

The type list is defined in a `POI_TYPES` constant, making it easy to extend.
Each entry maps OSM tags to a category, icon, and i18n label key.

### D9: POI display

When a waypoint is selected (clicked in sidebar or on map):

**Map**: Small circle markers appear around the selected waypoint showing nearby
POIs. Each marker uses the category icon as a tooltip and is colored by type
(blue for water, green for camping, orange for food, etc.). Markers are smaller
than waypoint markers to avoid visual confusion. They disappear when the waypoint
is deselected or a different waypoint is selected.

**Sidebar**: Below the waypoint's note area, a "Nearby" section lists POIs
grouped by category. Each item shows: icon, POI name (or "Unnamed" + type),
distance from waypoint (e.g., "120m"), and a snap button. The list is sorted by
distance, closest first. Maximum 15 POIs shown to avoid overwhelming the UI;
remaining are hidden behind "Show more".

Clicking a POI in the sidebar highlights it on the map. Clicking a POI marker on
the map scrolls the sidebar to that POI.

### D10: Snap behavior

Clicking the snap button (or clicking a POI marker on the map) performs:

1. **Move waypoint**: Set `lat`/`lon` on the waypoint Y.Map to the POI's
   coordinates. This triggers the existing route recalculation.
2. **Set name**: If the POI has an OSM `name` tag and the waypoint has no name
   (or the user confirms overwrite), set the waypoint name from the POI.
3. **Set note prefix**: Prepend the POI type icon and label to the waypoint's
   note. For example, snapping to a campsite named "Waldcamp" sets the note to
   "⛺ Campsite" (or "⛺ Campsite - Waldcamp" if named). If the waypoint already
   has a note, the prefix is prepended on a new line.
4. **Update POI list**: Re-fetch nearby POIs for the new location (since the
   waypoint moved).

All changes happen in a single Yjs transaction to keep the undo stack clean.

The user can always edit the name and note after snapping. Snapping is a
convenience, not a constraint.

### D11: POI caching

Overpass responses are cached in memory to avoid redundant network requests:

- **Cache key**: Quantized bounding box tile. Coordinates are rounded to a grid
  (~500m tiles) so nearby waypoints share a cache entry.
- **TTL**: 1 hour. POI data changes infrequently; stale data is acceptable.
- **Storage**: Plain `Map<string, { data: POI[]; timestamp: number }>` in a
  module-level variable. Not stored in Yjs (POI data is ephemeral, not shared
  between collaborators).
- **Eviction**: On access, expired entries are removed. Maximum 50 cached tiles
  to bound memory usage.

### D12: Overpass rate limiting

The public Overpass API has usage policies (no more than 2 concurrent requests,
10,000 requests/day). We respect these with:

- **Debounce**: Wait 500ms after a waypoint is selected before querying. If the
  user clicks through waypoints quickly, only the last selection triggers a query.
- **Concurrency**: Maximum 1 in-flight Overpass request. If a new request is
  needed while one is pending, the pending one is aborted (via `AbortController`).
- **Backoff on 429**: If Overpass returns HTTP 429 (rate limit), disable POI
  queries for 60 seconds and show a subtle "POI lookup unavailable" message.
- **Timeout**: 10-second timeout on Overpass requests. On timeout, fail silently
  (POIs are a nice-to-have, not critical).

## Risks / Trade-offs

- **Last-write-wins for notes**: If two users edit the same waypoint's note
  simultaneously, one edit is lost. Acceptable for short notes; upgrade path to
  Y.Text exists.
- **Soft character limit**: Not enforced at the data layer. A programmatic client
  could write longer notes. UI handles gracefully with truncation.
- **Note icon clutter on map**: Many waypoints with notes could make the map
  busy. Mitigate by keeping the indicator small and subtle. Consider hiding
  indicators at low zoom levels in a future iteration.
- **Overpass API availability**: The public Overpass instance may be slow or
  unavailable. POI features degrade gracefully - the Planner works fine without
  them. No error modals; just empty POI lists.
- **POI data quality**: OSM data varies by region. Some areas have sparse POI
  coverage. Users should not rely solely on POI snapping for critical waypoints
  like water sources.
- **Snap overwrites**: Snapping moves the waypoint and can change its name/note.
  Mitigated by keeping the action explicit (requires click) and making all fields
  editable after snap. Undo via Yjs history restores the previous state.
