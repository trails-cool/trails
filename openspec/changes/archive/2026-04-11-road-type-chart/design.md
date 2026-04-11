## Context

The Planner's route visualization supports four color modes: plain, elevation, surface, and grade. These modes color both the map polyline (`ColoredRoute.tsx`) and the elevation chart (`ElevationChart.tsx`), synced via a `colorMode` key in Yjs `routeData`.

Surface data is already extracted from BRouter's tiledesc messages by parsing `surface=*` from the `WayTags` column. The same `WayTags` column contains `highway=*` tags (e.g., `highway=residential`, `highway=cycleway`, `highway=track`) which classify the road type — but this data is currently discarded.

The data pipeline is: BRouter response → `extractSurfacesFromMessages()` → `EnrichedRoute.surfaces[]` → Yjs `routeData.surfaces` → consumed by chart and map. Road type will follow the same path.

## Goals / Non-Goals

**Goals:**
- Add a "Road Type" color mode that colors the route by OSM highway classification
- Follow the exact same patterns as the existing surface color mode (extraction, storage, rendering)
- Provide a meaningful color palette that distinguishes road categories at a glance
- Support both EN and DE translations

**Non-Goals:**
- Custom color palettes or user-configurable road type colors
- Filtering or hiding certain road types from the route
- Road type data in the Journal app (Planner-only for now)
- Aggregated road type statistics (e.g., "42% cycleway") — can be added later

## Decisions

### 1. Extract highway tags alongside surface tags

**Decision**: Extend `extractSurfacesFromMessages` to also extract `highway=*` tags, returning both in a combined result. Add a `highways: string[]` field to `EnrichedRoute`.

**Rationale**: The WayTags column already contains both tags. Extracting them in the same pass avoids iterating the messages twice. Keeping `surfaces` and `highways` as separate parallel arrays maintains backward compatibility and matches the existing pattern.

**Alternative considered**: A single `extractTagsFromMessages` returning a map of tag→values. Rejected because it would change the surface extraction API for no benefit.

### 2. Color palette grouped by road category

**Decision**: Group OSM highway values into intuitive color families:
- **Major roads** (motorway, trunk, primary): reds/oranges — signals caution for cyclists
- **Urban roads** (secondary, tertiary, residential, unclassified): grays/blues — neutral
- **Paths & tracks** (cycleway, path, footway, track, bridleway): greens — generally preferred
- **Service & other** (service, pedestrian, steps, living_street): muted tones

**Rationale**: Cyclists typically want to see at a glance where their route uses dedicated cycling infrastructure vs. shared roads. The red-for-major, green-for-paths scheme makes this immediately visible.

### 3. Extend ColorMode union type

**Decision**: Add `"highway"` to the `ColorMode` type union in `ColoredRoute.tsx`. Use `"highway"` as the internal value (matching the OSM tag name) while displaying "Road Type" / "Straßentyp" to users.

**Rationale**: Internal names match OSM conventions. User-facing labels use i18n and can be friendlier.

### 4. Store highway data in Yjs like surfaces

**Decision**: Store as `yjs.routeData.set("highways", JSON.stringify(highways))`, following the exact pattern used for surfaces.

**Rationale**: Consistency. All per-point route metadata follows this pattern. No schema changes needed.

## Risks / Trade-offs

**[Risk] Missing highway tags in some BRouter profiles** → Some BRouter routing profiles may not include `highway` in WayTags. Mitigation: fall back to `"unknown"` (same as surface mode) and display in a neutral default color.

**[Risk] Too many highway values in the legend** → OSM has dozens of highway values. Mitigation: Show at most 6 in the inline legend (same cap as surface mode), with a "+N" overflow indicator.

**[Trade-off] `highway` internal name vs. `road-type` user-facing name** → Slight naming mismatch, but keeps code aligned with OSM terminology which is the standard data source.
