## Context

`packages/gpx/src/parse.ts` parses GPX via DOM queries with no input hardening: `parseFloat(attr ?? "0")` turns missing coordinates into `0,0` and garbage into `NaN`; `NaN` passes the journal's range validation (`NaN < -90` is false) and flows into haversine distance, gain/loss totals (`loss += Math.abs(NaN)` → `NaN` persisted), and PostGIS geometry. `<rte>`/`rtept` is not parsed at all, so route-only exports fail `validateGpx`'s ≥2-track-points check. Timestamps are passed through as raw strings; `moving-time.ts` defends itself per interval, but partially-broken timestamp runs silently shrink moving time, and `startTime` derivation trusts the first point.

Organic Maps' parser (`serdes_gpx.cpp`) handles each of these with small, explicit policies backed by a corpus of real files from other apps (OsmAnd, Garmin, gpx.studio, OpenTracks). This design adapts those policies; it consciously skips OM behaviors trails doesn't need (track color namespaces, KML interop).

Consumers of the parser: journal save/import (`gpx-save.server.ts`), Komoot and Wahoo sync, planner GPX load, and all downstream stats (`elevationSeries`, `movingTime`, `computeDays`).

## Goals / Non-Goals

**Goals:**
- A GPX file that any mainstream app exports imports correctly; a file with some broken points imports with the broken points discarded rather than corrupted stats or rejection.
- Deterministic, documented repair policies (skip vs. interpolate vs. drop) pinned by a fixture corpus.
- No shape change to `GpxData`; no behavior change for already-well-formed files (except `<cmt>`/track-name fallback enriching metadata).

**Non-Goals:**
- Track color / display extensions (nothing in trails renders per-track color).
- GPX 1.0, `<extensions>` beyond the existing `trails:` namespace, KML/FIT import.
- Changing `validateGpx` thresholds or error taxonomy — it stays the loud backstop (`gpx-save` spec unchanged).
- Fixing files with systematically wrong data (e.g. all-zero elevation) — garbage that parses cleanly is out of scope.

## Decisions

### 1. Skip invalid points at parse time; keep validation strict

Points whose `lat`/`lon` attribute is missing or does not parse to a finite number are skipped. Unparseable `<ele>` becomes `undefined` (the existing "no elevation" representation). Rationale: salvage the usable majority of a file (OM's approach — log and continue) instead of either rejecting the file or corrupting downstream math. `validateGpx` continues to reject files with <2 surviving points or out-of-range coordinates, so "everything was garbage" still fails loudly, satisfying the existing `gpx-save` requirements.

*Alternative:* throw on the first bad point — rejected; one bad point from a flaky recorder would block an otherwise fine 4-hour activity.

Numeric parsing stays `parseFloat`-lenient (accepts leading `+`, tolerates trailing junk like `471.0m`) but every result is gated by `Number.isFinite` before the point is accepted.

Segments left empty (or with a single point) after skipping are dropped, mirroring OM's ≤1-point-segment discard — a 1-point segment renders nothing and breaks distance math assumptions.

### 2. Parse `<rte>` as tracks

Each `<rte>` becomes one track segment appended after `<trk>` segments, with `rtept` handled identically to `trkpt` (same lenience, `ele`/`time` supported). Downstream code and specs already speak in "track points"; converting at the parser boundary (exactly OM's model — routes import as tracks) means zero consumer changes. Route-level `<name>`/`<desc>` participate in the metadata fallback (Decision 4).

### 3. Timestamp repair as a post-parse pass (OM policy)

New pure function (own module, e.g. `timestamp-repair.ts`) applied per segment after parsing:
- Validity = `Date.parse` yields a finite value.
- If >50% of a segment's timestamps are invalid → drop all timestamps in that segment (a mostly-broken time channel is noise; downstream treats it as an untimed track).
- Otherwise → linearly interpolate invalid runs between their valid neighbors; leading/trailing invalid runs clamp to the nearest valid timestamp. Repaired values are written back as ISO strings.

This keeps `movingTime`, elapsed duration, and `startTime` meaningful for files from flaky recorders without any change to those functions. Monotonicity is not enforced here — `movingTime` already skips non-positive intervals, and reordering recorded data would be fabrication.

*Alternative:* validate timestamps lazily in each consumer — rejected; three consumers would each need the same policy and would inevitably drift.

### 4. Metadata fallback and `<cmt>` merge

`name`/`description` resolution order: `<metadata>` first, else the first `<trk>`/`<rte>`'s `<name>`/`<desc>`. A `<cmt>` on that track/route is appended to the description (blank-line separated) when present and not identical to it — OM's `BuildDescription` dedup rule. Low-risk enrichment; many apps put the only human-readable title on the `<trk>`.

### 5. Fixture corpus as files, not inline strings

New `packages/gpx/fixtures/*.gpx` — small, purpose-named files (`route-only.gpx`, `missing-coords.gpx`, `garbage-ele.gpx`, `timestamps-partial.gpx`, `timestamps-mostly-invalid.gpx`, `multi-track.gpx`, `unicode-name.gpx`, `namespaced-extensions.gpx`, plus a trimmed real-world export per integration we support — Komoot, Wahoo). Loaded by `parse-node.test.ts` via `fs`. Files are trivially addable when the next user bug report arrives — the corpus is the regression mechanism, which is the real lesson from OM's test suite. Inline-string tests stay for focused unit cases.

## Risks / Trade-offs

- [Silently skipping points can hide data loss from users] → Skipping is bounded by `validateGpx` (<2 survivors still rejects). If user-visible reporting is ever wanted, a `skippedPoints` count can be added to `GpxData` later without breaking shape.
- [Interpolated timestamps are fabricated data] → Bounded by the >50% drop rule and segment locality; interpolation only fills gaps between real measurements, the same trade OM ships. Moving-time impact is small and strictly better than silently dropped intervals.
- [`parseFloat` lenience accepts sloppy values like `48.1abc`] → Deliberate (matches OM and real-world files); `Number.isFinite` gate plus range validation still exclude everything harmful.
- [Route-only files previously rejected now import — user-visible behavior change] → Intended; strictly permissive, no existing imports change meaning.

## Migration Plan

Pure library change in `@trails-cool/gpx`; both apps pick it up on deploy. No schema/API/config changes. Rollback = revert PR. No backfill: previously-rejected files simply import on retry.

## Open Questions

- None blocking. Whether to surface a "N unusable points skipped" notice in the import UI is a product question deferred until someone actually hits it.
