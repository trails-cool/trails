## ADDED Requirements

### Requirement: Compact single-source geometry encoding
The planner SHALL store a computed route's geometry once in the session document, as a compactly encoded polyline (fixed-precision delta encoding) rather than as stringified JSON floating-point coordinates, and SHALL derive any GeoJSON representation from it at read time. The encoding SHALL be lossless within the route's working precision (≈1 m).

#### Scenario: Geometry is not stored twice
- **WHEN** the routing host writes a computed route to the session document
- **THEN** the document contains a single encoded geometry value, not both a `geojson` LineString and a separate `coordinates` array

#### Scenario: Coordinates round-trip within precision
- **WHEN** a route's coordinates are encoded and then decoded
- **THEN** every decoded coordinate is within ~1 m of the original

### Requirement: Run-length-encoded road metadata
The planner SHALL store the per-coordinate road-metadata channels (surface, highway, maxspeed, smoothness, tracktype, cycleway, bikeroute) run-length encoded, and SHALL decode them back to the per-coordinate values readers expect.

#### Scenario: Uniform metadata collapses
- **WHEN** a long run of coordinates shares the same surface value
- **THEN** that run is stored as a single value+length pair, and decoding restores one value per coordinate

### Requirement: Backward-compatible reads
The planner SHALL read a session document written in either the legacy JSON format or the new compact encoding, transparently, with no migration step. A route written before this change SHALL render, export, and color correctly.

#### Scenario: Legacy document still works
- **WHEN** a session persisted in the legacy JSON format is loaded
- **THEN** its route geometry and road metadata decode correctly and the session behaves as before

#### Scenario: Legacy document re-encodes on recompute
- **WHEN** the routing host recomputes the route for a legacy-format session
- **THEN** the route is rewritten in the new compact encoding

### Requirement: Preserved compute-once model and outputs
The compact encoding SHALL NOT change how the route is computed or shared: the elected routing host computes the route once and writes it to the document for all participants to read, and clients SHALL NOT recompute to obtain geometry. Decoded coordinates SHALL preserve the router's own precision (fixed to ~0.1 m / 6 decimals), so GPX export is unchanged in practice for router-produced routes.

#### Scenario: One computation, shared to all
- **WHEN** multiple participants view a session
- **THEN** exactly one client (the routing host) computes the route and the others read the encoded result from the document

#### Scenario: GPX export preserves coordinates
- **WHEN** the same route is exported to GPX under the legacy and the new encoding
- **THEN** every exported coordinate matches within ~0.1 m (the encoding is lossless at the router's 6-decimal precision)

### Requirement: Bounded document size
A computed route of a realistic length SHALL occupy substantially less of the per-session document budget than the legacy encoding, keeping typical routes well under the document size cap.

#### Scenario: A long route stays small
- **WHEN** a multi-waypoint route spanning tens of kilometres is stored
- **THEN** its serialized document size is a small fraction of the 5 MB cap (target ≈5× smaller than the legacy encoding)
