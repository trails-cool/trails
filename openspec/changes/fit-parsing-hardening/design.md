## Context

`fitToGpx(buffer, name)` uses `fit-file-parser` (`force: true`), reads only `parsed.records`, filters on presence of lat/lon, and emits `generateGpx({ tracks: [trackPoints] })` — one segment. The parser also exposes `sessions` (with `start_time`, `total_timer_time`, `sport`, `sub_sport`) and `events` (`event: 'timer'`, `event_type: 'stop_all' | 'start'`), which we currently discard. Downstream, `movingTime` in `@trails-cool/gpx` treats segment boundaries as hard breaks and per-interval gaps > 60 s as pauses — but only if segments/timestamps are honest. GPX validation requires ≥2 points.

Endurain's `utils_fit.py` informs the quirk list: enhanced fields preferred, per-session record slicing, cursor resets at session boundaries so speed doesn't bridge gaps, coordinate conversion sanity, zero-sentinel handling.

## Goals / Non-Goals

**Goals:**
- Honest GPX out of every FIT file trails will realistically receive (Wahoo, Garmin, COROS): pauses and sessions become segment boundaries; corrected fields win; garbage records can't poison stats.
- One conversion module stays the single seam for all providers, with a richer but backward-compatible return shape.

**Non-Goals:**
- Sensor streams (HR/power/cadence/temp) — no journal model for them; revisit if activity streams ever land.
- Laps, structured workouts, developer fields, monitoring/wellness messages.
- Splitting multisport files into multiple *activities* (Endurain does; trails keeps one activity per provider workout — a triathlon imports as one activity with three segments).

## Decisions

### 1. Segmentation from events first, gaps second

Split segments on `timer stop_all` → next `start` pairs from the events stream. Files whose events are missing/unreliable (some devices) get a fallback: a record-to-record timestamp gap > 5 min starts a new segment. Both thresholds as named constants. Rationale: events are the device's own truth; the gap fallback matches `movingTime`'s MAX_GAP philosophy at a coarser grain and catches event-less files.

### 2. One activity, one `<trkseg>` per session

Records are sliced into sessions by `[start_time, start_time + total_elapsed_time]` windows (Endurain's `split_records_by_activity` approach), each becoming a segment (further split by pauses within). Keeping one *activity* preserves trails' one-workout-one-activity invariant and avoids inventing a multi-activity import UX; segment boundaries are enough to keep stats honest.

### 3. Validation gates mirror the GPX-parser-robustness rules

Coordinates must be finite and in range or the record is dropped; altitude non-finite → `undefined` (point kept); record without timestamp → dropped (FIT records are timestamped by spec; absence means corruption). This intentionally matches the policies in the `gpx-parser-robustness` change so both import formats behave identically downstream.

### 4. Return shape: `{ gpx, sport }` instead of `string`

`fitToGpx` returns `{ gpx: string | null, sport: SportType | null }` where sport maps FIT `sport`/`sub_sport` (session-level, first session wins) through a small table to trails' `SPORT_TYPES` (running→run, trail_running sub-sport→run, cycling→ride, gravel_cycling→gravel, mountain→mtb, hiking→hike, walking→walk, alpine/backcountry ski→ski, else→other/null). Call sites destructure; Wahoo's existing workout-type mapping stays as fallback when no FIT file exists.

## Risks / Trade-offs

- [fit-file-parser may not surface events/sessions uniformly across devices] → Fixture-driven: gather real files (Wahoo export, Garmin sample) before coding; the gap fallback covers event-less files.
- [Multi-segment GPX changes stats for re-imported activities] → Only new imports are affected (no reprocessing); moving time gets *more* accurate.
- [Sport mapping disagreements with providers' own type fields] → Provider-specific mapping wins where the provider sends an explicit type; FIT sport is the fallback, not the override — call-site rule documented in code.

## Migration Plan

Library-shaped change inside the journal app; ships with normal deploy; no schema change; rollback = revert. Existing activities untouched.

## Open Questions

- None blocking. Whether COROS FIT files carry quirks beyond this set is checked when that integration starts (fixtures first).
