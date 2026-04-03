## ADDED Requirements

### Requirement: Shared types package
The `@trails-cool/types` package SHALL export TypeScript interfaces for Route, Activity, Waypoint, RouteVersion, and RouteMetadata used by both apps.

#### Scenario: Import types in Planner
- **WHEN** the Planner app imports `@trails-cool/types`
- **THEN** it has access to the Waypoint, Route, and RouteMetadata interfaces

#### Scenario: Import types in Journal
- **WHEN** the Journal app imports `@trails-cool/types`
- **THEN** it has access to Route, Activity, RouteVersion, and RouteMetadata interfaces

### Requirement: GPX parsing package
The `@trails-cool/gpx` package SHALL parse GPX XML into structured data (waypoints, tracks, elevation) and generate GPX XML from structured data.

#### Scenario: Parse GPX to waypoints
- **WHEN** the gpx package parses a valid GPX file
- **THEN** it returns an array of Waypoint objects with lat, lon, and optional name

#### Scenario: Generate GPX from waypoints
- **WHEN** the gpx package is given an array of waypoints and a track
- **THEN** it generates a valid GPX XML string

#### Scenario: Extract elevation data
- **WHEN** the gpx package parses a GPX file with elevation data
- **THEN** it returns elevation gain, loss, and a profile array of distance/elevation pairs

### Requirement: Map rendering package
The `@trails-cool/map` package SHALL provide core React components (MapView, RouteLayer) for rendering Leaflet maps with configurable base layers and route overlays. Interactive features (route drag-reshape, ghost markers, no-go area drawing, elevation chart, cursor tracking, colored routes) are implemented directly in the Planner app since they are Planner-specific.

#### Scenario: Render map component
- **WHEN** the map package's MapView component is rendered with a center and zoom
- **THEN** a Leaflet map is displayed with the default OSM tile layer

#### Scenario: Display route on map
- **WHEN** the map package's RouteLayer component receives GeoJSON
- **THEN** it renders a polyline on the map

### Requirement: UI component package
The `@trails-cool/ui` package SHALL provide shared React components (buttons, layout, form elements) styled with Tailwind CSS.

#### Scenario: Use Button component
- **WHEN** an app renders the Button component from `@trails-cool/ui`
- **THEN** a styled button is displayed consistent with the trails.cool design

### Requirement: i18n package
The `@trails-cool/i18n` package SHALL provide react-i18next configuration and translation strings starting with English and German.

#### Scenario: Display German translation
- **WHEN** a user's browser locale is set to German
- **THEN** UI strings are displayed in German

#### Scenario: Fallback to English
- **WHEN** a user's browser locale is not supported
- **THEN** UI strings fall back to English
