## Why

Activities and routes display as bare stat rows — nothing tells a feed reader *where* "Sunday ride, 62 km" happened, which is often the most interesting fact. Endurain reverse-geocodes activity start points into city/country names (reviewed 2026-07-06), but does it by calling Nominatim/geocode.maps.co — a third-party request carrying user location that trails' privacy principles rule out. We can have the feature without the leak: an **offline** reverse geocoder using a bundled place dataset, running entirely on-instance.

## What Changes

- New shared package capability: offline reverse geocoding — nearest populated place (name, admin region, ISO country) for a coordinate, from a bundled GeoNames-derived dataset (`cities500`-class, a few MB), no network calls.
- Activities and routes gain a derived **location label** ("Freiburg, Germany"), computed at save/import time from the geometry's start point and stored on the row.
- Location shows on detail pages and feed/list cards; localized country names via the existing i18n locales.
- **Privacy-coupled**: the label derives from where the track starts, so it is masked whenever the start location is hidden — it follows the same rules as the map/start data under the `activity-privacy-controls` change (if that lands, its `hideLocation`-style flag governs this label; until then, the label is only shown where the geometry itself is visible).
- Backfill of existing rows via a one-shot background job.
- Not in scope: full address geocoding, location search/filtering, per-point location, and any online geocoding fallback.

## Capabilities

### New Capabilities
- `activity-locations`: Offline reverse geocoding of route/activity start points into display labels — dataset, derivation timing, storage, display, masking rule, and backfill.

### Modified Capabilities

<!-- none — feed/detail specs gain content additively; masking defers to activity-privacy-controls' capability when present -->

## Impact

- New `packages/geocode` (or module in an existing package): bundled dataset + nearest-place lookup (kd-tree/grid), pure and unit-tested; used by the journal only.
- `packages/db`: `location_name`, `location_country` (text, nullable) on `activities` and `routes` + migration.
- Journal: set at gpx-save/import time; one-shot pg-boss backfill job; feed card + detail page display (i18n).
- Privacy manifest: note that location labels are derived on-instance with no third-party calls.
- Bundle size: the dataset ships server-side only (journal), never to the browser.
