## 1. Helpers

- [ ] 1.1 Add a pure `movingTime(gpx)` helper to `@trails-cool/gpx` (sum inter-point intervals, exclude sub-threshold/stationary segments, max-gap guard); unit-test against fixtures with and without trackpoint times.
- [ ] 1.2 Add a `deriveRate({ distance, time, sportType })` helper returning `{ kind: "pace" | "speed", value }` with the sport→kind rule and speed default.
- [ ] 1.3 Add a `formatStat` helper (distance/elevation/time/speed/pace) routing labels + units through i18n.

## 2. Component

- [ ] 2.1 Build the shared `StatRow` (ordered `{ value, label, unit }` items; value-prominent layout; no data fetching).
- [ ] 2.2 Define the canonical headline order as a single exported constant the surfaces draw from.

## 3. Adopt across surfaces

- [ ] 3.1 Activity detail: replace the hand-rolled stats block with `StatRow` (full set incl. pace/speed + moving/elapsed).
- [ ] 3.2 Route detail: adopt `StatRow` (distance, ascent, descent; no time/pace).
- [ ] 3.3 Feed card: adopt `StatRow` compact subset (distance · time · pace/speed); expose the needed fields in the feed loader.
- [ ] 3.4 Profile activity list: adopt `StatRow` compact subset.

## 4. i18n

- [ ] 4.1 Add `journal.stats.*` keys (labels + unit suffixes for distance, elevation, time, speed, pace) to en + de.

## 5. Tests & checks

- [ ] 5.1 Unit: `movingTime` (with/without timestamps; moving ≤ elapsed), `deriveRate` (pace/speed/default), `formatStat`.
- [ ] 5.2 Component: `StatRow` renders ordered items; subset preserves order.
- [ ] 5.3 `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e` green.
