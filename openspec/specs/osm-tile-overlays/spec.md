## Purpose

Tile-based map overlays (hillshading, Waymarked Trails cycling/hiking/MTB routes) with support for multiple simultaneous overlays, proper attribution, and profile-aware auto-enabling.

## Requirements

### Requirement: Hillshading overlay
The Planner map SHALL offer a hillshading tile overlay that visualizes terrain relief.

#### Scenario: Enable hillshading
- **WHEN** a user toggles "Hillshading" in the layer switcher
- **THEN** semi-transparent terrain shading tiles are rendered on top of the base layer

#### Scenario: Hillshading with any base layer
- **WHEN** hillshading is enabled and the user switches base layers
- **THEN** hillshading remains visible on top of the new base layer

### Requirement: Waymarked Trails cycling overlay
The Planner map SHALL offer a Waymarked Trails cycling overlay showing official cycle route networks.

#### Scenario: Enable cycling routes overlay
- **WHEN** a user toggles "Cycling Routes" in the layer switcher
- **THEN** official cycling routes (EuroVelo, national networks) are rendered as colored lines on the map from Waymarked Trails tiles

#### Scenario: Cycling overlay at different zoom levels
- **WHEN** cycling routes overlay is enabled
- **THEN** international routes are visible at low zoom and local routes appear at higher zoom levels

### Requirement: Waymarked Trails hiking overlay
The Planner map SHALL offer a Waymarked Trails hiking overlay showing official hiking trail networks.

#### Scenario: Enable hiking routes overlay
- **WHEN** a user toggles "Hiking Routes" in the layer switcher
- **THEN** official hiking trails (GR routes, national trails) are rendered as colored lines on the map

### Requirement: Waymarked Trails MTB overlay
The Planner map SHALL offer a Waymarked Trails MTB overlay showing official mountain bike trail networks.

#### Scenario: Enable MTB routes overlay
- **WHEN** a user toggles "MTB Routes" in the layer switcher
- **THEN** official MTB trails are rendered as colored lines on the map

### Requirement: Multiple simultaneous overlays
The Planner map SHALL support enabling multiple tile overlays at the same time.

#### Scenario: Hillshading plus cycling routes
- **WHEN** a user enables both "Hillshading" and "Cycling Routes"
- **THEN** both overlays are visible simultaneously, with cycling routes rendered above hillshading

### Requirement: Overlay tile attribution
Each tile overlay SHALL display proper attribution when enabled.

#### Scenario: Attribution updates
- **WHEN** an overlay is toggled on
- **THEN** its attribution text is added to the map attribution control
- **WHEN** the overlay is toggled off
- **THEN** its attribution text is removed

### Requirement: Profile-aware overlay suggestions
The Planner SHALL auto-enable relevant tile overlays when the routing profile changes.

#### Scenario: Switch to cycling profile
- **WHEN** the routing profile is changed to a cycling variant
- **THEN** the Waymarked Trails cycling overlay is automatically enabled

#### Scenario: Switch to hiking profile
- **WHEN** the routing profile is changed to a hiking variant
- **THEN** the Waymarked Trails hiking overlay is automatically enabled

#### Scenario: User can disable auto-enabled overlays
- **WHEN** an overlay was auto-enabled by a profile change
- **THEN** the user can manually disable it and it stays disabled until the next profile change
