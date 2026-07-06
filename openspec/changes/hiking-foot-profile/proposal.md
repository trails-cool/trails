## Why

The planner's "Hiking" option (de: "Wandern") is BRouter's `trekking` profile — a trekking-**bike** profile. Users planning a hike get bicycle routing: stairs and demanding footpaths are penalized or avoided, cycleways are preferred, and bicycle access rules apply, so the "Hiking" route is often not the route a hiker would (or could) take. trails.cool is an outdoor platform whose flagship use case is hiking; the routing should actually route on foot. This also unblocks the `hiking-time-estimate` change from being keyed to a mislabeled profile.

## What Changes

- The BRouter image guarantees a **foot routing profile named `hiking`** (from the pinned BRouter release's hiking profile, renamed; a vendored community foot profile is the fallback if the release doesn't ship one — verified during implementation).
- The planner profile selector gains **`hiking`** (en "Hiking", de "Wandern") and the existing `trekking` profile is **relabeled honestly** (en "Cycling (touring)", de "Radfahren (Touren)"). Available profiles become `hiking, trekking, fastbike, safety, shortest, car`; default stays `fastbike`.
- `@trails-cool/map-core` profile mappings move to the right sports: the `waymarked-hiking` tile overlay and hiking POI defaults (shelter, viewpoints) key on `hiking`; `trekking` gets the cycling defaults (`waymarked-cycling`, bike infrastructure) like the other bike profiles.
- Existing sessions are untouched: Yjs documents storing `trekking` keep routing exactly as before — only the label they see changes.
- The not-yet-implemented `hiking-time-estimate` change is retargeted to gate on the `hiking` profile (its artifacts are updated as part of this change's scope).
- Not in scope: SAC-scale-aware routing options (e.g. "avoid alpine routes"), per-country profile variants, and changing the demo bot's `trekking` usage (its synthetic routes remain plausible bike rides).

## Capabilities

### New Capabilities

<!-- none — foot routing is an extension of the existing brouter-integration capability -->

### Modified Capabilities
- `brouter-integration`: the "Profile selection" requirement's profile list gains `hiking`, and a new requirement pins the availability and foot semantics of the `hiking` profile in the BRouter image.

## Impact

- `docker/brouter/Dockerfile` — provide/rename the foot profile as `hiking.brf`; the existing WayTags patch loop must apply to it (deploys via `cd-brouter.yml` to the dedicated host).
- `apps/planner/app/components/ProfileSelector.tsx` — profile list + order.
- `packages/map-core/src/poi.ts` — `profiles` arrays and `profileOverlayDefaults` remapping.
- `packages/i18n` — en/de label additions and the trekking relabel.
- `e2e/integration.test.ts` — add a hiking-profile routing case alongside the existing trekking ones.
- `openspec/changes/hiking-time-estimate/` — gate updated from `trekking` to `hiking`.
- No schema/API changes; the BRouter proxy passes profile names through unchanged.
