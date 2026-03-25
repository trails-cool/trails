## MODIFIED Requirements

### Requirement: Map cursor rendering
Other participants' cursors on the map SHALL be clearly visible with proper styling.

#### Scenario: Cursor appearance
- **WHEN** another participant moves their mouse on the map
- **THEN** a colored pointer icon with their name tag appears at the cursor position

#### Scenario: Cursor does not obscure map controls
- **WHEN** cursors are rendered
- **THEN** they appear below map controls (zoom, layer switcher) in z-index
