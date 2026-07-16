## Why

The shared FIT→GPX converter (`apps/journal/app/lib/connected-services/fit.ts`) is 40 lines: it takes every record with coordinates and emits one flat track segment. It ignores pause/resume events (moving time and speed bridge lunch breaks), ignores sessions (a multisport file becomes one merged track), passes device altitude through without preferring the corrected `enhanced_altitude`, and does no coordinate sanity checks. Wahoo already feeds it; the Garmin importer (in flight) and COROS (planned) will too, multiplying every gap. Endurain's 1,100-line FIT handler (reviewed 2026-07-06) is a catalog of exactly which quirks matter in the wild — we adopt the subset relevant to trails' GPX-centric model.

## What Changes

- **Pause-aware segmentation**: FIT `event` stop/start pairs (and, as fallback, record gaps > 5 minutes) split the output into multiple `<trkseg>`s, so downstream moving-time and instant-speed math never bridges a pause.
- **Session-aware output**: multi-session files (multisport) produce one `<trkseg>` per session with records sliced to each session's time window; single-session behavior unchanged.
- **Field preference and validation**: prefer `enhanced_altitude`/`enhanced_speed` over base fields; drop records with non-finite or out-of-range coordinates or non-finite altitude (altitude → undefined, record kept); require a timestamp per record.
- **Sport extraction**: expose the file's session sport/sub-sport mapped to trails' `SportType` so importers stop guessing (Wahoo importer currently maps workout-type codes itself; it can consume this when a FIT file is present).
- Not in scope: HR/cadence/power/temperature streams (trails doesn't model them), lap extraction, developer fields, FIT *writing* (unchanged in `@trails-cool/fit`).

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities
- `wahoo-import`: the "FIT to GPX conversion" requirement is extended with pause/session segmentation, enhanced-field preference, and record validation guarantees.

## Impact

- `apps/journal/app/lib/connected-services/fit.ts` — the converter grows the four behaviors above; returns optional sport metadata alongside the GPX.
- Wahoo importer/webhook + Garmin importer consume the richer return type (backward-compatible: GPX string still primary).
- Tests: fixture FIT files (pause, multisport, garbage-coordinate) added next to the module; Endurain's `backend/tests/.../test_utils_fit.py` catalog is the reference for cases.
- No schema or API changes.
