## ADDED Requirements

### Requirement: Route hover highlights elevation chart
Hovering over the route polyline on the map SHALL highlight the corresponding position on the elevation chart.

#### Scenario: Hover route on map
- **WHEN** a user hovers over the route polyline on the map
- **THEN** the elevation chart shows a crosshair at the corresponding distance along the route

#### Scenario: Leave route on map
- **WHEN** a user moves the mouse away from the route polyline
- **THEN** the elevation chart crosshair disappears

### Requirement: Chart click pans map
Clicking on the elevation chart SHALL pan the map to center on that point along the route.

#### Scenario: Click chart
- **WHEN** a user clicks on the elevation chart
- **THEN** the map pans to center on the corresponding route coordinate

### Requirement: Chart drag-select zooms map
Dragging a range on the elevation chart SHALL zoom the map to fit that section of the route.

#### Scenario: Drag select range
- **WHEN** a user clicks and drags horizontally on the elevation chart
- **THEN** a visual highlight shows the selected range
- **AND** on mouse release, the map zooms to fit the route coordinates within that range

#### Scenario: Reset zoom
- **WHEN** the map has been zoomed via chart drag-select
- **THEN** a reset button appears to return to the full route view

### Requirement: Mobile touch interaction
The elevation chart SHALL support touch-based interaction on mobile devices.

#### Scenario: Single touch scrub
- **WHEN** a user touches and drags on the chart with one finger
- **THEN** the crosshair follows the finger position along the chart
- **AND** the map highlight dot follows in real-time

#### Scenario: Tap to pan
- **WHEN** a user taps the chart (touch without significant movement)
- **THEN** the map pans to that point along the route

#### Scenario: Two-finger range select
- **WHEN** a user places two fingers on the chart
- **THEN** the area between the fingers is highlighted as a selection range
- **AND** on release, the map zooms to fit the route coordinates in that range

#### Scenario: No page scroll on touch
- **WHEN** a user touches the elevation chart
- **THEN** page scrolling is prevented (touch-none CSS + preventDefault)

### Requirement: iOS safe area support
The Planner layout SHALL respect iOS safe area insets.

#### Scenario: Notch/Dynamic Island clearance
- **WHEN** the Planner is viewed on an iOS device with a notch or Dynamic Island
- **THEN** the header bar is padded below the safe area inset

#### Scenario: Home indicator clearance
- **WHEN** the Planner is viewed on an iOS device without a physical home button
- **THEN** the elevation chart area is padded above the home indicator

#### Scenario: No accidental page zoom
- **WHEN** a user pinches on the Planner UI
- **THEN** the browser-level page zoom does not trigger (viewport user-scalable=no)

### Requirement: Responsive mobile header
The Planner header SHALL adapt to small screens by hiding secondary controls.

#### Scenario: Small screen header
- **WHEN** the Planner is viewed on a mobile device
- **THEN** only the profile selector and export button are visible
- **AND** participant list, undo/redo, connection status, and computing text are hidden

#### Scenario: Desktop header
- **WHEN** the Planner is viewed on a desktop screen
- **THEN** all header controls are visible
