# trails.cool GPX Extensions

trails.cool uses a custom XML namespace to store planning metadata in GPX files. This allows round-tripping through export, import, and Journal save without losing information.

## Namespace

```
xmlns:trails="https://trails.cool/gpx/1"
```

Declared on the root `<gpx>` element whenever any extension is present.

---

## `<trails:poi>` — POI metadata on waypoints

Stored inside `<wpt><extensions>`. Carries the OpenStreetMap node ID and key tags for waypoints that were snapped to a POI in the Planner.

### Syntax

```xml
<wpt lat="52.52" lon="13.405">
  <name>Bike Shop Berlin</name>
  <extensions>
    <trails:poi osmId="123456">
      <trails:tag k="phone" v="+49 30 12345"/>
      <trails:tag k="website" v="https://example.com"/>
      <trails:tag k="opening_hours" v="Mo-Fr 09:00-18:00"/>
      <trails:tag k="addr:street" v="Unter den Linden"/>
      <trails:tag k="addr:housenumber" v="1"/>
      <trails:tag k="addr:postcode" v="10117"/>
      <trails:tag k="addr:city" v="Berlin"/>
    </trails:poi>
  </extensions>
</wpt>
```

### Attributes

| Attribute | Required | Description |
|-----------|----------|-------------|
| `osmId`   | no       | OSM node ID (integer). Present when the waypoint was snapped to a known OSM node. |

### Child elements

Each `<trails:tag>` stores one OSM tag. The following keys are persisted:

| Key | Description |
|-----|-------------|
| `phone` / `contact:phone` | Phone number |
| `website` | Website URL |
| `opening_hours` | OSM opening hours string (e.g. `Mo-Fr 09:00-18:00`) |
| `addr:street` | Street name |
| `addr:housenumber` | House number |
| `addr:postcode` | Postal code |
| `addr:city` | City |
| `amenity` | OSM amenity value (e.g. `bicycle_shop`) |
| `tourism` | OSM tourism value (e.g. `camp_site`) |
| `shop` | OSM shop value |

### Display

The Journal route detail page renders a **Waypoints** section when at least one waypoint has POI metadata. Phone numbers become `tel:` links; websites become `https:` links.

---

## `<trails:planning>` — Planning metadata on routes

Stored inside the top-level `<extensions>` element. Carries no-go areas defined in the Planner.

### Syntax

```xml
<extensions>
  <trails:planning>
    <trails:nogo>
      <trails:point lat="52.51" lon="13.40"/>
      <trails:point lat="52.51" lon="13.41"/>
      <trails:point lat="52.52" lon="13.41"/>
    </trails:nogo>
  </trails:planning>
</extensions>
```

### Elements

| Element | Description |
|---------|-------------|
| `<trails:planning>` | Container for all planning metadata. |
| `<trails:nogo>` | A no-go area polygon. Requires at least 3 `<trails:point>` children. Multiple `<trails:nogo>` elements are allowed. |
| `<trails:point lat="…" lon="…"/>` | A vertex of the no-go polygon. |

No-go areas are passed to BRouter when computing routes, which routes around them. They are preserved through export/import and Journal save.

---

## Compatibility

These extensions are **forward-compatible**: parsers that don't know the `trails:` namespace will ignore the `<extensions>` blocks and load the file as a normal GPX. Geometry, waypoint names, and elevation data are always stored in standard GPX elements.

The namespace URI `https://trails.cool/gpx/1` is versioned. If the schema changes incompatibly, the minor version will increment.
