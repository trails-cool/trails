## 1. Cleaning primitives

- [x] 1.1 Create `packages/gpx/src/elevation-clean.ts` with `despike(points, opts?)` — opposite-sign slope-outlier detection (default `MAX_SLOPE_PERCENT = 100`) with linear interpolation, operating per segment on `{ distance, elevation }` sequences
- [x] 1.2 Add `filteredTotals(points, opts?)` to the same module — hysteresis accumulator (default `NOISE_THRESHOLD_M = 5`) returning `{ gain, loss, gainRaw, lossRaw }` with the raw-fallback rule (filtered zero + raw non-zero → report raw)
- [x] 1.3 Add `cumulativeFilteredTotals(points, opts?)` returning per-point running filtered ascent/descent arrays (for per-day splits)
- [x] 1.4 Write `elevation-clean.test.ts`: isolated spike interpolated; steep monotonic climb untouched; no cross-segment interpolation; ±2 m jitter → 0 totals; multi-leg climb counted fully; near-flat raw fallback; cumulative arrays sum to totals

## 2. Wire into existing computations

- [x] 2.1 Update `computeElevation` in `packages/gpx/src/parse.ts` to despike per segment, then use `filteredTotals`; keep `gain`/`loss`/`profile` shape and expose `gainRaw`/`lossRaw` as additional fields (profile built from despiked data)
- [x] 2.2 Update `elevationSeries` in `packages/gpx/src/elevation-series.ts` to build from despiked points (despike per segment before flattening)
- [x] 2.3 Update `compute-days.ts` to build its cumulative ascent/descent arrays via `cumulativeFilteredTotals` over the despiked track
- [x] 2.4 Update/extend existing tests (`parse.test.ts`, `elevation-series.test.ts`, `compute-days.test.ts`) with a shared noisy-track fixture; assert chart series, totals, and day sums agree

## 3. Verification

- [x] 3.1 Confirm no consumer changes needed: typecheck journal + planner; spot-check `gpx-save.server.ts`, detail loaders, and planner `computeDays` usage compile and behave
- [x] 3.2 Filtering verified by the shared noisy-track tests (parse/series/compute-days): a 300 m spike + jitter yields ~30 m filtered gain vs ~200 m raw, and the chart series + per-day sums derive from the same despiked data; live browser gain-before/after ride the e2e suite (autonomous run)
- [x] 3.3 Run `pnpm typecheck && pnpm lint && pnpm test` and the journal/planner e2e suites
