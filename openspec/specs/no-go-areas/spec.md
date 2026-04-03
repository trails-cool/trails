## Requirements

### Requirement: Draw no-go areas
Users SHALL be able to draw polygons on the map that BRouter avoids when computing routes.

#### Scenario: Draw polygon
- **WHEN** a user activates the no-go area tool and draws a polygon on the map
- **THEN** the polygon is added to the Yjs doc and visible to all participants

#### Scenario: Route avoids no-go area
- **WHEN** a route is computed and a no-go area intersects the direct path
- **THEN** BRouter request includes the polygon vertices via the `polygons` parameter
- **AND** BRouter routes around the no-go area

#### Scenario: Delete no-go area
- **WHEN** a user right-clicks a no-go area polygon
- **THEN** it is removed from the Yjs doc and the route is recomputed

### Requirement: Persist no-go areas in GPX
No-go areas SHALL be preserved when saving to the journal or exporting a plan.

#### Scenario: Save to Journal
- **WHEN** a user saves a route to the journal from the planner
- **THEN** the GPX includes no-go area polygons in `<extensions>` using the `trails:planning` namespace
- **AND** editing the route in the planner restores the no-go areas

#### Scenario: Export Plan
- **WHEN** a user exports a plan (via "Export Plan" dropdown option)
- **THEN** the GPX includes waypoints, track, and no-go areas in `<extensions>`
- **AND** reimporting the plan into the planner restores all planning data

#### Scenario: Export Route
- **WHEN** a user exports a route (default export or "Export Route" dropdown option)
- **THEN** the GPX includes only the computed track (no waypoints, no extensions)
- **AND** the file is compatible with any GPX-consuming application

### Requirement: GPX extensions format
No-go areas are stored in GPX using a custom XML namespace:

```xml
<gpx xmlns:trails="https://trails.cool/gpx/1">
  <extensions>
    <trails:planning>
      <trails:nogo>
        <trails:point lat="52.5" lon="13.3"/>
        <trails:point lat="52.4" lon="13.4"/>
        <trails:point lat="52.3" lon="13.2"/>
      </trails:nogo>
    </trails:planning>
  </extensions>
</gpx>
```

- Each `<trails:nogo>` element contains 3+ `<trails:point>` elements
- Parser accepts both namespaced (`trails:nogo`) and non-namespaced (`nogo`) elements
- Areas with fewer than 3 points are rejected on parse
