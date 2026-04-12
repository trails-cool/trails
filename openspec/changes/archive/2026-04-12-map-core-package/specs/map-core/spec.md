## ADDED Requirements

### Requirement: Renderer-agnostic map definitions
The `@trails-cool/map-core` package SHALL provide map configuration data usable by any rendering engine.

#### Scenario: Tile source definitions
- **WHEN** a renderer needs tile layer URLs
- **THEN** `map-core` provides base layer and overlay layer configs with URL templates, attribution, and zoom limits

#### Scenario: Route color palettes
- **WHEN** a renderer needs to color a route by surface, highway, grade, or other mode
- **THEN** `map-core` provides the color mapping and color functions for all supported modes

#### Scenario: POI category definitions
- **WHEN** a renderer needs POI icons, colors, and Overpass queries
- **THEN** `map-core` provides the full category configuration

### Requirement: No rendering dependencies
The package SHALL have zero dependencies on any rendering library (Leaflet, MapLibre, React, DOM).

#### Scenario: Import in any environment
- **WHEN** `map-core` is imported in Node.js, a browser, or React Native
- **THEN** it works without errors — no DOM APIs, no rendering side effects
