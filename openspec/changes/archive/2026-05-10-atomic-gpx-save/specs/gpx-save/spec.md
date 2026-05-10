# gpx-save Specification

## Purpose

Atomic GPX validation and PostGIS geometry persistence for routes and activities. Every write of a GPX track in the Journal SHALL validate the track and persist the row + geometry in a single transaction. Silent geometry failures are not permitted.

## Requirements

### Requirement: GPX validation before any DB write

The Journal SHALL validate any GPX string before writing a route or activity row. Validation SHALL confirm the GPX parses successfully, contains at least 2 track points, and all track points have coordinates within valid ranges (latitude −90..90, longitude −180..180). Validation SHALL throw `GpxValidationError` on failure.

#### Scenario: Valid GPX proceeds to save

- **WHEN** a caller passes a GPX string with ≥2 track points and valid coordinates to `createRoute`, `updateRoute`, `createActivity`, or `createRouteFromActivity`
- **THEN** the save proceeds and no `GpxValidationError` is thrown

#### Scenario: GPX with fewer than 2 track points is rejected

- **WHEN** a caller passes a GPX string that produces fewer than 2 track points
- **THEN** `GpxValidationError` is thrown before any DB write occurs

#### Scenario: GPX with out-of-range coordinates is rejected

- **WHEN** a caller passes a GPX string containing coordinates outside valid ranges
- **THEN** `GpxValidationError` is thrown before any DB write occurs

#### Scenario: Unparseable GPX is rejected

- **WHEN** a caller passes a malformed GPX string that cannot be parsed
- **THEN** `GpxValidationError` is thrown before any DB write occurs

### Requirement: Atomic row + geometry persistence

Every route or activity save that includes a GPX string SHALL wrap the row write, PostGIS geometry write, and version snapshot in a single database transaction. If any step fails, the entire transaction SHALL be rolled back — a route or activity row with a non-null `gpx` column and a null `geom` column SHALL NOT be possible through the normal save path.

#### Scenario: Successful save stores row and geometry atomically

- **WHEN** `createRoute` is called with valid GPX
- **THEN** the `routes` row, the `geom` column update, and the `routeVersions` row are all committed in a single transaction

#### Scenario: PostGIS failure rolls back the row insert

- **WHEN** the PostGIS geometry write fails during a `createRoute` call
- **THEN** the transaction is rolled back and no `routes` row is persisted

#### Scenario: Route update is atomic

- **WHEN** `updateRoute` is called with valid GPX
- **THEN** the row update, geometry update, and new version snapshot are committed atomically

#### Scenario: Activity save is atomic

- **WHEN** `createActivity` is called with valid GPX
- **THEN** the `activities` row and `geom` column update are committed atomically

### Requirement: Loud failure on geometry errors

The Journal SHALL NOT swallow PostGIS geometry write errors. Any failure during the geometry write SHALL propagate as a thrown exception, causing the enclosing transaction to roll back and the error to surface to the caller.

#### Scenario: Geometry write error surfaces to caller

- **WHEN** the PostGIS `UPDATE geom` statement fails
- **THEN** an exception is thrown, the transaction is rolled back, and the caller receives the error

#### Scenario: demo-bot route creation fails loudly

- **WHEN** `createRoute` is called from the demo-bot and the PostGIS write fails
- **THEN** the exception propagates — no partial route row is committed

### Requirement: Single gpx-save module owns geometry persistence

The Journal SHALL have exactly one module responsible for GPX validation and PostGIS geometry writes: `apps/journal/app/lib/gpx-save.server.ts`. No other module SHALL call PostGIS geometry update statements directly or implement GPX validation independently.

#### Scenario: activities.server.ts uses gpx-save for geometry

- **WHEN** `createActivity` or `createRouteFromActivity` writes geometry
- **THEN** the write goes through the `gpx-save` module, not an inline raw SQL statement

#### Scenario: demo-bot uses createRoute and createActivity

- **WHEN** the demo-bot creates synthetic routes and activities
- **THEN** it calls `createRoute` and `createActivity` rather than issuing raw inserts and calling `setGeomFromGpx` directly
