## 1. Series helper

- [ ] 1.1 Add a helper (in `@trails-cool/gpx` or the journal lib) that turns GPX into `{ distance, elevation, lat, lng }[]`, downsampled to ~500 points; unit-test it (incl. the no-elevation case → empty/invalid series).
- [ ] 1.2 Expose the series + summary (ascent/descent/high/low) from the route and activity detail loaders.

## 2. Chart component

- [ ] 2.1 Build a presentational `ElevationProfile` SVG area chart (gradient fill via the `map-core` elevation/gradient scale) with the ascent/descent/high/low summary strip.
- [ ] 2.2 Render nothing when the series has no usable elevation.

## 3. Active-distance interaction

- [ ] 3.1 Lift an `activeDistance | null` state above the detail page's map + chart.
- [ ] 3.2 Chart hover → set `activeDistance`; map shows a marker at the interpolated lat/lng.
- [ ] 3.3 Map route-line hover → set `activeDistance` (nearest sample); chart shows a crosshair/marker.
- [ ] 3.4 Chart click → center the map on that location (read-only). Throttle pointer updates; memoize interpolation.

## 4. Wire-in & i18n

- [ ] 4.1 Mount `ElevationProfile` + shared state in `routes.$id.tsx` and `activities.$id.tsx`.
- [ ] 4.2 Add `journal.elevation.*` keys (ascent, descent, highest, lowest) to en + de.

## 5. Tests & checks

- [ ] 5.1 Unit: series helper (sampling, summary numbers, no-elevation → omitted).
- [ ] 5.2 Component: chart renders for a series; renders nothing for an empty series.
- [ ] 5.3 E2E: open a route detail with elevation, assert the chart + summary appear; hovering the chart shows a map marker.
- [ ] 5.4 `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e` green.
