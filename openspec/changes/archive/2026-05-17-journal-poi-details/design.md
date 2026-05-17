# Design: Journal POI Details

## Data Flow

POI metadata already flows from Overpass → POI snap → Yjs Y.Map (`osmId`, `poiTags`). The gap is that neither GPX export nor the Journal save extracts these fields.

```
Yjs Y.Map
  { lat, lon, name, overnight, osmId, poiTags: { phone, website, ... } }
          ↓ (currently drops osmId + poiTags)
  Waypoint type → generateGpx → GPX <wpt>
          ↓
  Journal DB → route.gpx
          ↓ (currently not parsed)
  Journal route detail page
```

## Changes

### 1. `@trails-cool/types` — extend `Waypoint`

Add optional POI fields to the shared `Waypoint` interface:

```ts
export interface Waypoint {
  lat: number;
  lon: number;
  name?: string;
  isDayBreak?: boolean;
  osmId?: number;
  poiTags?: {
    phone?: string;
    website?: string;
    opening_hours?: string;
    "addr:street"?: string;
    "addr:housenumber"?: string;
    "addr:postcode"?: string;
    "addr:city"?: string;
    amenity?: string;
    tourism?: string;
    shop?: string;
  };
}
```

### 2. Planner — extract `osmId` + `poiTags` from Yjs

In `ExportButton.tsx` and `SaveToJournalButton.tsx`, add the two fields to the waypoint mapping:

```ts
osmId: yMap.get("osmId") as number | undefined,
poiTags: yMap.get("poiTags") as Waypoint["poiTags"] | undefined,
```

### 3. GPX — encode/decode POI fields as `<extensions>`

**`generate.ts`**: When a waypoint has `osmId` or `poiTags`, emit a `<extensions><trails:poi ...>` block inside `<wpt>`. Always declare the `trails:` namespace on the root `<gpx>` element (already done for noGoAreas, just extend the condition).

```xml
<wpt lat="52.5" lon="13.4">
  <name>Fahrradhändler Müller</name>
  <extensions>
    <trails:poi osmId="123456">
      <trails:tag k="phone" v="+49 30 12345"/>
      <trails:tag k="website" v="https://example.com"/>
      <trails:tag k="opening_hours" v="Mo-Fr 09:00-18:00"/>
    </trails:poi>
  </extensions>
</wpt>
```

**`parse.ts`**: In `parseWaypoints`, query `trails:poi` (and unprefixed `poi`) extensions; read the `osmId` attribute and `trails:tag` children.

### 4. Journal route detail — display POI metadata

In `routes.$id.tsx`:
- Parse waypoints from `route.gpx` in the loader (already done for `dayStats`, can reuse that parse)
- Pass waypoints with POI data to the component
- Render a `WaypointList` section showing: waypoint name + coords, and if `poiTags` present: phone (tel: link), website (https: link), opening hours, address

No new DB columns needed — everything lives in the GPX string already stored in `routes.gpx`.

## Non-Goals

- No new DB columns for POI data
- No Overpass lookups in the Journal
- No display of `osmId` to the user (internal reference only)
- Opening hours parsing/formatting: display raw string as-is
