## Context

Profile flow today: `ProfileSelector.tsx` writes one of `["fastbike", "safety", "shortest", "car", "trekking"]` into the Yjs route data; the routing host sends it through the planner's BRouter proxy (`brouter.ts`, default `"trekking"`, no allowlist — BRouter 404s unknown profiles); the segment cache keys on the profile string. `packages/i18n` labels `trekking` as "Hiking"/"Wandern". `map-core` keys hiking behavior on `trekking`: `profileOverlayDefaults.trekking = ["waymarked-hiking"]` and hiking POI categories list `trekking` in their `profiles`. BRouter's `trekking.brf` is, per upstream, a trekking-bicycle profile.

The BRouter image (`docker/brouter/Dockerfile`, pinned release 1.7.9) copies the release's `profiles2/*` into `/data/profiles` and patches every `.brf` to emit extra WayTags. Upstream BRouter ships a hiking profile in recent releases (`hiking-beta.brf`); whether 1.7.9's zip contains it must be verified at implementation time.

## Goals / Non-Goals

**Goals:**
- Selecting "Hiking" produces genuine pedestrian routing (footpaths, stairs, foot access rules).
- Every profile is labeled as what it is; no behavior change for any existing profile or saved session.
- UI profile ids equal BRouter profile names — no mapping layer.

**Non-Goals:**
- Routing options within hiking (avoid SAC T3+, prefer marked trails) — needs profile parameters, its own change.
- Country-specific profile variants (the Organic Maps localization pattern) — no demand yet.
- Touching the demo bot or existing e2e trekking fixtures beyond adding hiking coverage.

## Decisions

### 1. The image guarantees a profile literally named `hiking`

The Dockerfile copies/renames the chosen foot profile to `/data/profiles/hiking.brf`, so the UI id, the Yjs value, the cache key, and the BRouter profile name are the same string and `brouter.ts` needs no mapping table. Selection order for the source `.brf`:
1. `hiking-beta.brf` from the pinned release zip, if present (upstream-maintained, zero vendoring).
2. Otherwise vendor a pinned, license-checked community foot profile (e.g. the widely used poutnikl hiking family) into `docker/brouter/profiles/` — the repo already establishes profile patching in the image, so vendoring one file is consistent.

The WayTags sed patch must demonstrably apply to the new file (it iterates `*.brf`, but the profile's structure — `dummyUsage` vs `context:node` — decides which branch fires; verified by a build-stage grep).

*Alternative:* send `hiking-beta` from the client and keep the upstream filename — rejected; leaks an upstream naming quirk ("beta") into the UI id, Yjs documents, and cache keys forever.

### 2. `trekking` stays, relabeled

`trekking` is a good touring-bike profile and existing Yjs sessions reference it. It remains in the selector as en "Cycling (touring)" / de "Radfahren (Touren)". Saved sessions keep their exact routing; only the label corrects itself. Selector order becomes `hiking, trekking, fastbike, safety, shortest, car` — foot first on an outdoor platform.

*Alternative:* migrate stored `trekking` values to a new id — rejected; planner sessions are ephemeral Yjs docs, there is nothing to migrate server-side, and silently changing a session's routing behavior mid-collaboration would be worse than a label fix.

### 3. `map-core` mappings move by sport, spec stays satisfied

`profileOverlayDefaults`: `hiking → ["waymarked-hiking"]`, `trekking → ["waymarked-cycling"]` (joining fastbike/safety). POI category `profiles` arrays: hiking-ish categories (shelter, viewpoints) switch `trekking → hiking`; bike infrastructure adds `trekking`. The `osm-poi-overlays` spec's "Profile-aware POI defaults" requirement is written against "hiking variant"/"cycling variant" and needs no delta — the variants just point at the right profiles now.

### 4. Cross-change coordination with `hiking-time-estimate`

That change (proposed, unimplemented) gates the Tobler estimate on the foot profile and currently names `trekking`. Its design/tasks are edited in this change to gate on `hiking`. If it happens to be implemented first, its tasks note the dependency instead of blocking.

## Risks / Trade-offs

- [Release 1.7.9 may not ship `hiking-beta.brf`] → Fallback decided up front (vendor pinned community profile); either way the image build fails loudly if `/data/profiles/hiking.brf` is absent (explicit check in the Dockerfile).
- [Foot profile quality unvetted for our use] → Validation task: compare hiking routes against known paths (stairs, footpath-only connections) before relabeling ships; the trekking profile remains available regardless.
- [Users' muscle memory: "Hiking" now routes differently] → That is the point; the old behavior remains one entry below under its honest name. Release note callout.
- [BRouter host redeploy required (`cd-brouter.yml`), separate from app deploy] → Deploy image first, app second: the app change is inert until the profile exists upstream — ordering documented in tasks; wrong order just means BRouter 404s for `hiking` briefly, surfaced by the existing routing-error UI.

## Migration Plan

1. Ship the Docker image change (`cd-brouter.yml` deploys to the dedicated host); verify `hiking` routes via the proxy in production.
2. Ship the app change (selector, labels, map-core, i18n, e2e).
No data migration; rollback is reverting either PR independently (app revert removes the option; image revert makes `hiking` 404 — revert app first if both must go).

## Open Questions

- None blocking. Which exact foot `.brf` wins (upstream vs vendored) is resolved by task 1.1's verification, with the decision criteria fixed above.
