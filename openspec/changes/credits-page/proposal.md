## Why

trails.cool owes its shape to other open projects — BRouter, bikerouter.de, brouter-web, wanderer, and (as of the 2026-07 research) Organic Maps and Endurain — and builds on data that carries attribution obligations (OpenStreetMap; GeoNames once `activity-locations` lands). Today that acknowledgment lives only in `docs/philosophy.md`, invisible to users. A user-visible credits page makes the acknowledgment real, gives data attributions a durable home beyond the map corner, and matches how the projects we admire credit their own inputs (Organic Maps' `copyright.html`, its required-credit NOTICE).

## What Changes

- New **`/about/credits`** page on the Journal with three curated sections:
  1. **Inspirations** — the projects from the philosophy doc's acknowledgment list, each with a link and a one-line "what we learned from them".
  2. **Data** — OpenStreetMap (© OpenStreetMap contributors, ODbL), BRouter routing segments, tile providers, and a slot for GeoNames (CC-BY) when `activity-locations` ships.
  3. **Built with** — a short curated list of load-bearing open-source components (BRouter, Leaflet, Yjs, Fedify, PostGIS), not a generated dependency dump.
- **Footer link** "Credits" in both apps (planner links to the Journal page, same pattern as the legal links).
- The page and `docs/philosophy.md`'s acknowledgment list are cross-referenced so they stay in sync (comment in both pointing at the other).
- Localized (en/de) like every user-facing surface.
- Not in scope: an auto-generated full dependency-license inventory (can be a later `licenses` page if ever needed), donation/sponsor listings.

## Capabilities

### New Capabilities
- `credits-page`: The user-visible credits & inspirations page — content sections, localization, and its footer entry point.

### Modified Capabilities
- `legal-disclaimers`: the "Footer legal links" requirement gains the Credits link in both apps.

## Impact

- `apps/journal`: new route `about.credits.tsx` (+ registration in `routes.ts`), Footer link.
- `apps/planner`: footer variant gains the absolute link to the Journal page.
- `packages/i18n`: footer label + page strings (en/de).
- `docs/philosophy.md`: cross-reference comment.
- `activity-locations` and `poi-index` tasks that mention "journal credits" now have their concrete target surface.
