# gpx-parsing Specification

## Purpose
Robust, lenient GPX parsing in `@trails-cool/gpx`: a file any mainstream app exports imports correctly, and a file with some broken points imports with those points discarded rather than corrupting stats or being rejected. Covers invalid-point skipping (no Null Island / NaN totals), `<rte>` route support, post-parse timestamp repair, metadata/`<cmt>` fallback, and a fixture corpus as the regression mechanism — while `validateGpx` stays the strict backstop.

## Requirements
### Requirement: Invalid track points are skipped, not defaulted
The GPX parser SHALL skip track and route points whose `lat` or `lon` attribute is missing or does not parse to a finite number, and SHALL treat an unparseable `<ele>` value as absent elevation. Skipped or repaired points SHALL never surface as `0,0` coordinates or `NaN` values in parsed output, distance, or elevation totals. Segments left with fewer than two points after skipping SHALL be dropped.

#### Scenario: Point with missing coordinates is skipped
- **WHEN** a track contains a `trkpt` without a `lat` attribute among otherwise valid points
- **THEN** that point is absent from the parsed track and no `0,0` point appears

#### Scenario: Garbage coordinates do not poison stats
- **WHEN** a `trkpt` has a non-numeric `lat` value
- **THEN** the point is skipped and the computed distance and elevation totals are finite numbers

#### Scenario: Unparseable elevation treated as missing
- **WHEN** a `trkpt` has `<ele>` content that does not parse to a finite number
- **THEN** the point is kept with no elevation and gain/loss totals remain finite

#### Scenario: Degenerate segment dropped
- **WHEN** a `trkseg` has only one valid point after skipping
- **THEN** that segment does not appear in the parsed tracks

### Requirement: Route elements parse as tracks
The GPX parser SHALL parse each `<rte>` element as a track segment, handling `rtept` identically to `trkpt` (including elevation, time, and invalid-point skipping), appended after any `<trk>` segments.

#### Scenario: Route-only GPX imports
- **WHEN** a GPX file contains only a `<rte>` with valid `rtept` points and no `<trk>`
- **THEN** the parsed data contains one track segment with those points
- **AND** journal validation accepts the file

#### Scenario: Mixed tracks and routes
- **WHEN** a GPX file contains both `<trk>` and `<rte>` elements
- **THEN** all appear as track segments with track segments first

### Requirement: Timestamp repair
The GPX parser SHALL repair point timestamps per segment: when more than half of a segment's timestamps are invalid, all timestamps in that segment SHALL be dropped; otherwise invalid timestamps SHALL be linearly interpolated between the nearest valid neighbors, with leading and trailing invalid runs set to the nearest valid timestamp. Repaired timestamps SHALL be valid ISO 8601 strings.

#### Scenario: Sparse invalid timestamps interpolated
- **WHEN** a segment has a minority of unparseable `<time>` values between valid ones
- **THEN** those points receive timestamps interpolated between the surrounding valid times

#### Scenario: Mostly-invalid timestamps dropped
- **WHEN** more than half of a segment's `<time>` values are unparseable
- **THEN** every point in that segment has no timestamp
- **AND** moving time computation returns null for a track consisting only of such segments

#### Scenario: Leading invalid run clamps
- **WHEN** the first points of a segment have invalid timestamps and later points are valid
- **THEN** the leading points receive the first valid timestamp

### Requirement: Metadata fallback from tracks and routes
The GPX parser SHALL fall back to the first track's or route's `<name>` and `<desc>` when `<metadata>` provides none, and SHALL merge a track-level `<cmt>` into the description (separated by a blank line) when it is present and differs from the description.

#### Scenario: Track name used when metadata absent
- **WHEN** a GPX file has no `<metadata><name>` but its `<trk>` has a `<name>`
- **THEN** the parsed name is the track's name

#### Scenario: Identical cmt not duplicated
- **WHEN** a track's `<cmt>` equals its `<desc>`
- **THEN** the description contains the text once

### Requirement: Regression fixture corpus
The GPX package SHALL maintain a corpus of fixture GPX files exercising the repair policies (route-only, missing/garbage coordinates, unparseable elevation, partially and mostly invalid timestamps, multi-track/multi-segment, Unicode names, foreign-namespace extensions), and the parser test suite SHALL parse every fixture and assert the repaired output, so future parser changes cannot silently regress real-world compatibility.

#### Scenario: All fixtures parse under test
- **WHEN** the parser test suite runs
- **THEN** every fixture file is parsed and its expected repaired output is asserted

#### Scenario: Foreign namespaces ignored gracefully
- **WHEN** a fixture contains extension elements from other apps' namespaces (e.g. Garmin, OsmAnd)
- **THEN** parsing succeeds and trails-relevant data is extracted unchanged

