## Context

Endurain resolves activity locations by HTTP-geocoding start coordinates against Nominatim or geocode.maps.co (`activity/utils.py:1271`) — exactly the third-party location leak trails' privacy posture forbids (same reasoning that just drove the `poi-index` change to remove Overpass). trails stores route/activity geometry in PostGIS and GPX; start point is trivially available at save time (`gpx-save.server.ts` already extracts coords and startTime).

GeoNames publishes redistributable (CC-BY) place datasets; `cities500` (~200k populated places with name, admin1, country, lat/lon) compresses to a few MB — small enough to bundle, dense enough that a nearest-place lookup names the right town for outdoor activity starts.

## Goals / Non-Goals

**Goals:**
- "Freiburg im Breisgau, Germany" on activities and routes with zero third-party requests and zero config for self-hosters.
- Deterministic, offline, fast (sub-millisecond lookup), computed once at write time.
- The label never reveals more than the visible geometry already does.

**Non-Goals:**
- Street/trailhead-level naming, multilingual place names (dataset ships primary names; country names localize via i18n), location-based search or grouping, online fallback of any kind.

## Decisions

### 1. Bundled GeoNames `cities500` + nearest-neighbor lookup, in-process

New `packages/geocode`: build script converts the GeoNames TSV into a compact sorted binary/JSON artifact checked into the package (with attribution + license file); runtime loads it once and answers `nearestPlace(lat, lon)` via a static grid index (place count is small enough that a 1°-cell grid with neighbor scan beats pulling in a kd-tree dep). Returns `{name, admin1, countryCode, distanceKm}`.

*Alternatives:* PostGIS table + spatial query — works, but turns a pure function into a schema + seed concern and complicates self-host setup; Nominatim self-hosted — absurd footprint for naming a start town; per-request third-party geocoding — ruled out by principle.

### 2. Label rules

Use the first point of the geometry. If the nearest place is > 30 km away (open ocean, wilderness), fall back to country only; if > 200 km or no country, store null (no label). Store `location_name` ("Freiburg im Breisgau") and `location_country` (ISO code, rendered localized client-side). Computed in `gpx-save.server.ts`'s derive step so every creation path (upload, planner save, Wahoo/Garmin/Komoot import, federation ingest of remote activities is **excluded** — remote rows keep whatever the origin published, we don't re-derive from remote geometry).

### 3. Masking follows the geometry, one rule

The label is shown only where the viewer may see the track start: today that means it renders wherever the map/GPX renders for that viewer. When `activity-privacy-controls` lands, its location/start-hiding flag governs the label through the same mask helper. This coupling is stated in both changes so neither ships a leak.

### 4. Backfill as a one-shot job

pg-boss job iterates rows with geometry and null `location_name` in batches. Runs once on deploy; re-runnable safely (idempotent predicate).

## Risks / Trade-offs

- [Nearest-place can name the wrong side of a border/ridge] → Cosmetic; 200k-place density makes gross errors rare; label is presentation-only, never used for logic.
- [Dataset staleness (renames, new places)] → Refresh = re-run the build script in a PR; places churn slowly.
- [CC-BY attribution obligation] → GeoNames attribution added to the package license file and the journal's about/credits, alongside existing OSM attribution.
- [Memory: dataset resident in the journal process] → ~200k compact records ≈ tens of MB worst case; measured in tasks, with the grid artifact designed for lazy load.

## Migration Plan

Additive columns + package + backfill job; display changes are progressive (null label renders nothing). Rollback = revert code; columns can stay.

## Open Questions

- None blocking. Whether route *end* location is also worth labeling ("Freiburg → Basel") is a display-only follow-up.
