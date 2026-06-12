## 1. Helpers

- [x] 1.1 Add a pure `movingTime(tracks)` helper to `@trails-cool/gpx` (sum inter-point intervals, exclude sub-threshold/stationary segments, max-gap guard); unit-tested with and without trackpoint times (`moving-time.ts` + test).
- [x] 1.2 Add a `deriveRate(distance, time, sportType)` helper returning `{ kind: "pace" | "speed", value }` with the sport→kind rule and speed default (`stats.ts`).
- [x] 1.3 Add pure `format*` helpers (distance/elevation/duration/speed/pace) in `stats.ts`; labels route through i18n at the call site (`activityStatItems`).

## 2. Component

- [x] 2.1 Build the shared `StatRow` (ordered `{ value, label }` items; size sm/lg; no data fetching).
- [x] 2.2 Canonical order encoded once in `activityStatItems` (distance · time · [moving] · pace/speed · ascent · descent); surfaces draw from it.

## 3. Adopt across surfaces

- [x] 3.1 Activity detail: replaced the card grid with `StatRow size="lg"` (full set incl. pace/speed + moving/elapsed); loader computes moving time from the GPX.
- [x] 3.2 Route detail: adopt `StatRow size="lg"` (distance, ascent, descent; no time/pace).
- [x] 3.3 Feed card: compact `StatRow` (distance · time · pace/speed); feed loader already exposes duration + sportType.
- [x] 3.4 Profile activity list: compact `StatRow`.

## 4. i18n

- [x] 4.1 Add `journal.stats.*` keys (distance, duration, movingTime, avgSpeed, avgPace, ascent, descent) to en + de.

## 5. Tests & checks

- [x] 5.1 Unit: `movingTime` (with/without timestamps; moving ≤ elapsed; stationary/gap exclusion), `deriveRate` (pace/speed/default/null), formatters.
- [x] 5.2 Component: `StatRow` renders ordered items (jsdom); `activityStatItems` ordering + compact-subset order asserted.
- [x] 5.3 typecheck + lint + unit (gpx 63, journal 311) green. Full `pnpm test:e2e` runs in CI.
