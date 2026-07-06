## 1. Model function

- [ ] 1.1 Create `packages/gpx/src/hiking-time.ts`: `toblerSpeedKmh(slope)`, `hikingTimeSeconds(points)`, `cumulativeHikingTimeSeconds(points)` — haversine horizontal distance, elevation slope with ±100% clamp, flat-speed fallback for missing elevation
- [ ] 1.2 `hiking-time.test.ts`: flat 5 km ≈ 1 h; −5% slope is the fastest; ±20% asymmetry (uphill > downhill > flat); missing-elevation fallback; clamp prevents near-zero speeds; cumulative array matches total
- [ ] 1.3 Export from `packages/gpx/src/index.ts`

## 2. Per-day support

- [ ] 2.1 Extend `computeDays(waypoints, tracks, opts?)` with `opts.estimateHikingTime` populating optional `DayStage.estimatedTimeSec` from the cumulative time array between stage boundaries
- [ ] 2.2 Tests: day times sum to route total; without opt-in the output is deep-equal to before; single-day route gets one stage with the full estimate

## 3. Planner integration

- [ ] 3.1 In `use-routing.ts`, when the active profile is the foot profile (`hiking` if the `hiking-foot-profile` change has landed, otherwise `trekking`), compute `estimatedTimeSec` from `enriched.coordinates` and include it in the route stats written for the sidebar
- [ ] 3.2 Display in `WaypointSidebar.tsx`: add the time to the compact stat line and the stats grid when present, with "≈" and h/min formatting
- [ ] 3.3 Display per-day times in `DayBreakdown.tsx` (pass the opt-in flag to the planner's `computeDays` call when the foot profile is active)
- [ ] 3.4 Add i18n strings (en: "Est. walking time" etc., de: "Gehzeit ca.") to `packages/i18n` planner namespaces — no hardcoded strings

## 4. Verification

- [ ] 4.1 Extend the planner e2e suite: with the Hiking profile a computed route shows a walking-time stat; switching to a cycling profile hides it
- [ ] 4.2 Manual sanity check against a known hike (e.g. a local route with signposted time) — estimate should be in the right ballpark
- [ ] 4.3 Run `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e`
