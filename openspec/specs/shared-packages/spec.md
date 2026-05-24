## Purpose

Shared TypeScript packages used by both Planner and Journal apps. All packages live under `packages/` and are published as `@trails-cool/<name>` within the monorepo via pnpm workspaces.

## Package overview

| Package | Name | Consumers |
|---|---|---|
| `types` | `@trails-cool/types` | Planner, Journal |
| `gpx` | `@trails-cool/gpx` | Planner, Journal |
| `fit` | `@trails-cool/fit` | Journal |
| `map` | `@trails-cool/map` | Planner |
| `map-core` | `@trails-cool/map-core` | Planner, Journal (server-side, jobs) |
| `ui` | `@trails-cool/ui` | Planner, Journal |
| `i18n` | `@trails-cool/i18n` | Planner, Journal |
| `api` | `@trails-cool/api` | Planner, Journal |
| `db` | `@trails-cool/db` | Journal |
| `jobs` | `@trails-cool/jobs` | Journal |
| `sentry-config` | `@trails-cool/sentry-config` | Planner, Journal |

## Requirements

### Requirement: Shared types package
The `@trails-cool/types` package SHALL export TypeScript interfaces for Route, Activity, Waypoint, RouteVersion, and RouteMetadata used by both apps.

#### Scenario: Import types in Planner
- **WHEN** the Planner app imports `@trails-cool/types`
- **THEN** it has access to the Waypoint, Route, and RouteMetadata interfaces

#### Scenario: Import types in Journal
- **WHEN** the Journal app imports `@trails-cool/types`
- **THEN** it has access to Route, Activity, RouteVersion, and RouteMetadata interfaces

### Requirement: GPX parsing package
The `@trails-cool/gpx` package SHALL parse GPX XML into structured data (waypoints, tracks, elevation) and generate GPX XML from structured data. It is the sole owner of GPX encoding and decoding — apps do not bundle their own GPX logic.

#### Scenario: Parse GPX to waypoints
- **WHEN** the gpx package parses a valid GPX file
- **THEN** it returns an array of Waypoint objects with lat, lon, and optional name

#### Scenario: Generate GPX from waypoints
- **WHEN** the gpx package is given an array of waypoints and a track
- **THEN** it generates a valid GPX XML string including the custom `<extensions>` namespace for trails.cool metadata (see `docs/gpx-extensions.md`)

#### Scenario: Extract elevation data
- **WHEN** the gpx package parses a GPX file with elevation data
- **THEN** it returns elevation gain, loss, and a profile array of distance/elevation pairs

### Requirement: FIT encoding package
The `@trails-cool/fit` package SHALL provide a `gpxToFitCourse` function that converts a GPX string to a FIT Course binary (`Uint8Array`) suitable for upload to Wahoo and other head units. It is the sole owner of FIT file generation; apps do not bundle their own FIT encoder. See `wahoo-route-push` spec for the full round-trip contract.

#### Scenario: Import gpxToFitCourse in Journal
- **WHEN** the Journal app imports `@trails-cool/fit`
- **THEN** it has access to `gpxToFitCourse({ gpx, name })` returning a `Uint8Array`

### Requirement: Map components package
The `@trails-cool/map` package SHALL provide React/Leaflet components (`MapView`, `RouteLayer`) for rendering interactive maps. It re-exports `@trails-cool/map-core` so consumers only need one import for both components and constants. Interactive Planner-specific features (midpoint handles, no-go drawing, elevation chart) are implemented in the Planner app, not in this package.

#### Scenario: Render map component
- **WHEN** the map package's MapView component is rendered with a center and zoom
- **THEN** a Leaflet map is displayed with the configured base tile layer

#### Scenario: Display route on map
- **WHEN** the map package's RouteLayer component receives GeoJSON
- **THEN** it renders a polyline on the map

### Requirement: Map constants package
The `@trails-cool/map-core` package SHALL provide framework-free map constants and utilities: tile/overlay layer configs, color palettes (surface, highway, smoothness, grade, etc.), POI category definitions, z-index constants, and snap distance. It has zero React/Leaflet dependencies so it can be imported in server-side code, jobs, and tests without pulling in browser globals.

#### Scenario: Import colors in Journal server code
- **WHEN** server-side Journal code imports `@trails-cool/map-core`
- **THEN** it has access to color maps and tile configs without importing React or Leaflet

### Requirement: UI component package
The `@trails-cool/ui` package SHALL provide shared React components (buttons, layout primitives, form elements) styled with Tailwind CSS, used by both apps.

### Requirement: i18n package
The `@trails-cool/i18n` package SHALL provide react-i18next configuration and translation strings for English (primary) and German.

#### Scenario: Display German translation
- **WHEN** a user's browser locale is set to German
- **THEN** UI strings are displayed in German

#### Scenario: Fallback to English
- **WHEN** a user's browser locale is not supported
- **THEN** UI strings fall back to English

### Requirement: API contracts package
The `@trails-cool/api` package SHALL define shared API contracts: endpoint URL constants, request/response types, pagination shapes, error codes, and API version. Both apps import from this package; neither defines its own duplicate API types.

### Requirement: Database package
The `@trails-cool/db` package SHALL provide the Drizzle ORM schema (all tables across `planner.*` and `journal.*` schemas), the database client factory, and migration helpers. The Journal app is the sole runtime consumer; the Planner references only `planner.*` tables. All schema changes flow through this package.

### Requirement: Background jobs package
The `@trails-cool/jobs` package SHALL provide the pg-boss client factory (`createBoss`), the worker registration helper, and the `JobDefinition` type that each job exports. Apps construct boss instances from this package rather than importing pg-boss directly.

### Requirement: Sentry configuration package
The `@trails-cool/sentry-config` package SHALL provide shared Sentry initialisation helpers used by both apps. It sets user context, attaches session IDs as tags, and configures source map upload. Apps call the shared helper from their Sentry entry points rather than configuring Sentry inline.
