## MODIFIED Requirements

### Requirement: Base layer switching
The map SHALL support switching between multiple base tile layers, and SHALL support toggling overlay tile layers independently.

#### Scenario: Switch to OpenTopoMap
- **WHEN** a user selects "OpenTopoMap" from the layer switcher
- **THEN** the map tiles change to topographic tiles from OpenTopoMap

#### Scenario: Available base layers
- **WHEN** a user opens the layer switcher
- **THEN** the options include OpenStreetMap, OpenTopoMap, and CyclOSM

#### Scenario: Available overlay layers
- **WHEN** a user opens the layer switcher
- **THEN** overlay checkboxes are shown for Hillshading, Cycling Routes, Hiking Routes, and MTB Routes

#### Scenario: Toggle overlay
- **WHEN** a user checks an overlay checkbox in the layer switcher
- **THEN** the overlay tiles are rendered on top of the current base layer
