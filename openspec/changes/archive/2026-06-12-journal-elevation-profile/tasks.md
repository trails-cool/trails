## 1. Series helper

- [x] 1.1 `elevationSeries(tracks, maxPoints=400)` in `@trails-cool/gpx` → `{ d, e, lat, lng }[]`, downsampled (keeps first/last), empty when <2 points carry elevation; unit-tested.
- [x] 1.2 Expose the series from the route + activity detail loaders (one parse; activity reuses the moving-time parse). Highest/lowest are computed in the chart; ascent/descent stay in the stat row.

## 2. Chart component

- [x] 2.1 Presentational `ElevationProfile` SVG area chart (vertical gradient fill) with a highest/lowest summary + a hover readout (distance · elevation).
- [x] 2.2 Renders nothing when the series has <2 points.

## 3. Active-distance interaction

- [x] 3.1 Lift a shared `activeIndex | null` (+ `centerOn`) above the detail page's map + chart.
- [x] 3.2 Chart hover → `onActive(index)`; map draws a `CircleMarker` at that sample's lat/lng.
- [x] 3.3 Map route hover → `HoverTracker` finds the nearest sample → `onHoverIndex`; chart draws a crosshair + dot.
- [x] 3.4 Chart pointer-down → `onSeek` bumps `centerOn`; map `panTo`s that point (read-only, no data change).

## 4. Wire-in & i18n

- [x] 4.1 Mounted in `routes.$id.tsx` and `activities.$id.tsx` (props forwarded through `ClientMap`).
- [x] 4.2 Add `journal.elevation.{highest,lowest}` to en + de.

## 5. Tests & checks

- [x] 5.1 Unit: `elevationSeries` (cumulative distance, flatten segments, downsample first/last, no-elevation → empty).
- [x] 5.2 Component (jsdom): chart renders for a series + highest/lowest summary; nothing for a too-short series; marker on active; `onSeek` on pointer-down.
- [x] 5.3 E2E: create an activity from an elevation GPX, assert the profile chart + summary render (`e2e/elevation-profile.test.ts`, registered in `playwright.config.ts`). Passes locally.
- [x] 5.4 typecheck + lint + unit (gpx 67, journal 315) green; new e2e passes locally. Full `pnpm test:e2e` runs in CI.
