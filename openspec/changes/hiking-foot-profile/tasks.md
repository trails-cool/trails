## 1. BRouter image

- [ ] 1.1 Verify whether the pinned BRouter 1.7.9 release zip ships a foot profile (`hiking-beta.brf` or similar); if yes, rename it to `hiking.brf` in the Dockerfile; if no, vendor a pinned, license-checked community foot profile into `docker/brouter/profiles/` and COPY it in
- [ ] 1.2 Add a Dockerfile build check that fails when `/data/profiles/hiking.brf` is absent; verify the WayTags patch applies to it (build-stage grep for the dummyUsage assigns)
- [ ] 1.3 Build the image locally (`pnpm dev:services`), request a route with profile `hiking`, and validate foot behavior: a stairs/footpath-only connection is used instead of a road detour; spot-check a known hike against the trekking result
- [ ] 1.4 Deploy via `cd-brouter.yml` and verify `hiking` routes through the production proxy

## 2. Planner app

- [ ] 2.1 Update `ProfileSelector.tsx`: `PROFILE_IDS = ["hiking", "trekking", "fastbike", "safety", "shortest", "car"]`
- [ ] 2.2 i18n: add `profiles.hiking` (en "Hiking", de "Wandern"); relabel `profiles.trekking` (en "Cycling (touring)", de "Radfahren (Touren)")
- [ ] 2.3 Update `packages/map-core/src/poi.ts`: move `waymarked-hiking` overlay default and hiking POI category `profiles` entries from `trekking` to `hiking`; add `trekking` to the cycling overlay/category defaults; update `poi.test.ts`
- [ ] 2.4 Verify no other `trekking` special-casing remains (`route-data.ts` default untouched — `fastbike` stays the default profile)

## 3. Cross-change coordination

- [ ] 3.1 Update `openspec/changes/hiking-time-estimate/` design + tasks to gate the Tobler estimate on profile `hiking` instead of `trekking`

## 4. Verification

- [ ] 4.1 Extend `e2e/integration.test.ts` with a hiking-profile route computation alongside the existing trekking cases
- [ ] 4.2 E2E: profile selector shows the new labels; switching to Hiking recomputes the route and auto-enables shelter/viewpoint POI defaults
- [ ] 4.3 Run `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e`
- [ ] 4.4 Release-note callout: "Hiking" now routes on foot; previous behavior lives under "Cycling (touring)"
