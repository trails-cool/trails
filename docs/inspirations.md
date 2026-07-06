# Inspirations & prior-art research

Durable record of the open-source projects we've studied, what we learned,
and which OpenSpec changes each insight spawned. This is the source of truth
for acknowledgments: the **credit line** under each project is the canonical
one-liner reused by `docs/philosophy.md` (Open Source section) and the
`/about/credits` page (see `openspec/changes/credits-page/`). Update all
three together when adding a project.

Research method: shallow-clone the repo, fan out parallel exploration agents
over focused areas (data model, integrations, product, ops, community), then
synthesize trails-relevant learnings and turn the actionable ones into
OpenSpec proposals. Clones live in ephemeral scratch space; this document is
what survives.

---

## BRouter, bikerouter.de, brouter-web (founding inspirations)

> **Credit line:** BRouter — the routing engine · bikerouter.de — inspiration
> for the Planner · brouter-web — the web client

The projects that made the Planner conceivable. BRouter is also a runtime
dependency (self-hosted routing engine, `docker/brouter/`). Not "researched"
in the sense below — they're in the product's DNA.

---

## Organic Maps — reviewed 2026-07-05

> **Credit line:** Organic Maps — inspiration for outdoor-focused map
> presentation, elevation handling, hiking-time estimation (Tobler), GPX
> robustness, and privacy-as-proof practices

Offline, privacy-absolutist OSM app (C++, [github.com/organicmaps/organicmaps](https://github.com/organicmaps/organicmaps)),
~10 years of map-domain experience inherited from MAPS.ME. Different
architecture (native offline vs web/federated), but it has solved many
problems on our roadmap.

### Key learnings (with their source locations)

- **Elevation profile hardening** (`libs/map/elevation_info.cpp`):
  opposite-sign slope-outlier despiking (single-point spikes interpolated
  out; monotonic climbs never touched), dual raw/threshold-filtered
  ascent totals (hysteresis accumulation), Douglas-Peucker profile
  simplification. Their Easy/Medium/Hard track difficulty rating is an
  unimplemented `@todo` — a feature we could ship first.
- **Hiking ETA** (`libs/routing/edge_estimator.cpp`): Tobler's hiking
  function for pedestrian speed-by-slope, downhill penalized at 0.35× of
  uphill, altitude penalty above 2500 m. Also the weight-speed vs ETA-speed
  split: route *choice* uses inflated speeds for nice paths; time estimates
  use realistic ones.
- **GPX robustness** (`libs/kml/serdes_gpx.cpp` + fixture corpus in
  `data/test_data/gpx/`): timestamp repair (>50% invalid per segment →
  drop all; else linear interpolation), leading `+` in coordinates,
  `<rte>` imported as tracks, `<cmt>`/desc merging with dedup,
  triple-namespace track-color export (Garmin gpxx + gpx_style + osmand)
  for interop. Their fixture corpus is real files from OsmAnd, gpx.studio,
  OpenTracks, Garmin.
- **Outdoor map presentation** (`data/styles/outdoors/`,
  `generator/osm2type.cpp`): a separate Outdoors style that promotes peaks,
  saddles, springs, drinking water to low zooms; `sac_scale` +
  `trail_visibility` collapsed into just two path grades (difficult/expert)
  for rendering — two values, big safety payoff. OSM route-relation
  membership shown on a path's page ("E5, GR5").
- **Own the data pipeline** (`tools/python/maps_generator/`,
  `generator/`): one batch pipeline from planet file to per-region packs
  carrying rendering + search + routing + elevation; precompute per-segment
  elevation at build time instead of querying a DEM live; `.poly`-file
  region splitting; category-as-pseudo-language search-trie trick (category
  IDs indexed as a fake language alongside names).
- **Practices**: privacy proven by third-party audit evidence published
  in-repo (Exodus reports) rather than asserted; opt-in email-with-log
  diagnostics instead of telemetry; excellent `docs/PR_GUIDE.md` (small-PR
  norm, LLM-use disclosure); anti-roadmap stance (milestones over a
  ROADMAP file); root CLAUDE.md with AGENTS.md symlink + nested per-domain
  CLAUDE.md files; GPS track-recording filter (`libs/map/gps_track_filter.cpp`:
  accuracy >250 m rejected, acceleration >2 m/s², bearing-flip rejection,
  file-backed ring buffer) — reference for `docs/ideas/mobile-activity-recording`.

### Changes spawned

`elevation-profile-hardening`, `gpx-parser-robustness`,
`hiking-time-estimate`, `poi-index` (pipeline pattern + evidence),
`hiking-foot-profile` (the review exposed the trekking-labeled-"Hiking"
mismatch).

### Explicitly not pursued

Deep-link codec (session URLs cover it), track-color export (nothing
renders colors), MWM/offline formats (wrong architecture for web).

---

## Endurain — reviewed 2026-07-06

> **Credit line:** Endurain — inspiration for the Journal's activity privacy
> controls, account export, duplicate handling, and self-hosting operator
> experience

Self-hosted Strava alternative ([codeberg.org/endurain-project/endurain](https://codeberg.org/endurain-project/endurain);
FastAPI + Vue, AGPL, single maintainer). Overlaps the Journal only; its
federation is frontend scaffolding — trails is ahead there.

### Key learnings (with their source locations)

- **Granular privacy** (`users/users_privacy_settings/models.py`,
  `activities/activity/models.py`, `apply_visibility_mask()`): ~13
  independent per-signal hide flags (start time, location, map, HR, power,
  pace, laps, gear…), per-user defaults stamped at import, per-activity
  overrides, one server-side mask, one frontend gate component.
- **Account export/import** (`users/users_profile/export_service.py`):
  streaming, memory-bounded ZIP of everything including original uploaded
  FIT/GPX files; matching import with ID remapping.
- **Cross-source duplicate handling** (`activities/activity/crud.py`):
  same-start-time match → store anyway, flag `is_hidden`, notify for manual
  review. Flag-and-review over silent auto-merge.
- **FIT parsing quirks catalog** (`activity_file_import/utils_fit.py`,
  1,147 lines of fitdecode handling): multi-session files → sliced
  per-session records, semicircle→degrees, timezone via TimezoneFinder +
  device-offset fallback for indoor, zero-HR sensor-dropout exclusion,
  `enhanced_*` fields preferred, cursor resets across pauses,
  `timestamp_16` rollover. Tests: `backend/tests/.../test_utils_fit.py`.
- **Elevation smoothing convergence** (`compute_elevation_gain_and_loss`):
  median(6) → moving-average(3) → 0.1 m threshold — independent
  confirmation that naive delta-summing overstates ascent.
- **Gear tracking** (`gears/`): types + retirement + mileage offset,
  components/consumables with `expected_kms` wear thresholds, time-based
  wear for racquets, default gear per activity type.
- **Operator experience** (`docs/getting-started/advanced-started.md`,
  three compose variants incl. Docker-secrets): ~45-variable documented env
  table; BYO-OAuth-credentials pattern (each self-hoster registers their
  own provider app). Auth stack is mature (refresh rotation, TOTP, OIDC,
  API keys, SSRF allowlists).
- **Contrasts that validate trails' choices**: unofficial password-based
  Garmin login with unlink-on-expiry (vs our official-API path), polling
  without webhooks (vs our Wahoo webhooks), no health endpoint/metrics, no
  changelog, offset pagination. `TRADEMARK.md` (AGPL code + registered
  word mark restricting commercial hosting) is an interesting governance
  read.

### Changes spawned

`account-export`, `activity-duplicate-review`, `fit-parsing-hardening`,
`activity-locations` (their feature, our privacy-preserving offline
redesign), `self-hosting-guide`, `activity-privacy-controls`.

---

## wanderer — reviewed 2026-07-06

> **Credit line:** wanderer — a self-hosted, federated trail database; the
> closest neighbor to the Journal's federated route sharing and proof the
> ActivityPub-for-trails idea works

Self-hosted federated trail database ([wanderer.to](https://wanderer.to),
[github.com/Flomp/wanderer](https://github.com/Flomp/wanderer); AGPL,
Go/PocketBase + SvelteKit + Meilisearch + WASM provider plugins). Same
route-vs-activity split as trails ("trails" + "summit logs"). The only
studied project that has shipped ActivityPub for trail content.

### Key learnings (with their source locations)

- **Federation is real and Mastodon-interops** (`db/federation/*.go`,
  `db/util/activitypub.go`, protocol doc
  `docs/src/content/docs/develop/federation.md` with full JSON examples):
  per-user RSA keys, signed fetch ("authorized fetch"), WebFinger,
  Follow/auto-Accept, Likes, comments as `Note` + `inReplyTo`, summit logs
  federate as first-class objects. **Object model: everything is a plain
  `Note`** — metrics ride in bespoke `tag[]` note entries, GPX as a
  `Document` attachment (3-photo cap, lossy unit encoding). Interop with
  trails' Fedify journal is feasible at the social layer; exchanging
  actual route data would need a wanderer-specific adapter. Their
  Note-with-attachments shape *is* why trails render in Mastodon — worth
  considering a Note-compatible representation alongside structured
  objects.
- **Federation weaknesses to avoid**: fire-and-forget delivery (detached
  goroutine, semaphore(5), no queue/retry — activities lost on transient
  failures), no inbound dedup/replay defense, no moderation or
  instance-blocking at all, no shared instance actor, signature
  verification coupled to `X-Forwarded-Path` proxy headers. Their SSRF-safe
  outbound HTTP client (`db/util/network.go`: private-IP blocking,
  30 req/min/origin) is worth copying.
- **Discovery at scale** (`db/util/meilisearch.go`,
  `db/routes/search_token.go`, `web/src/routes/api/v1/search/trails/cluster/`):
  Meilisearch with `_geo` + precomputed bbox scalars (antimeridian-aware
  viewport filters); **access control enforced at the index layer via
  tenant tokens** (anonymous → `public=true`; authed → public OR author OR
  shared-with, minted per session); server-side `supercluster` clustering
  where the largest-bbox trails render as polylines and the rest cluster;
  random-offset sampling for recommendations; remote/federated trails
  indexed as local stubs so cross-instance content is searchable.
- **Trail data model** (`db/migrations/1747064968_collections_snapshot.go`,
  `web/src/lib/models/`): polyline + bbox computed server-side on GPX
  change; stats recomputed from files, never trusted; dual-threshold
  elevation filter (5 m horizontal anchor / 5 m vertical, raw + smoothed
  kept — third independent confirmation that naive ascent summing is
  wrong); **optional DEM elevation correction via self-hosted Valhalla
  height service** (`gpx.correctElevation()`) — an idea trails hasn't
  considered; all formats (FIT/TCX/KML/KMZ) normalized to GPX at import.
- **Product features**: ordered trail lists with per-actor view/edit
  shares; **link-share tokens** (view/edit) for private content;
  9 notification types with **per-type web/email preferences**;
  **print view with map, elevation profile, scale bar, and QR code**
  (jsPDF) — paper backup for hikes; collection export as ZIP (GPX or JSON,
  photos + summit logs); hashed long-lived **API tokens** for third
  parties; sandboxed **WASM provider plugins** (Strava/Komoot/Hammerhead —
  plugins can't open sockets; a host executor injects auth and enforces
  policy; `plugins/README.md` is an excellent architecture doc).
- **Ops practices**: sectioned semver CHANGELOG with GHSA/PR references;
  boot-time hard failure on missing/default encryption keys; search index
  treated as rebuildable cache and excluded from backups; explicit
  AI-assisted-contribution policy in CONTRIBUTING. Cautionary tales:
  real default secrets committed in `docker-compose.yml`, no
  reverse-proxy/TLS setup docs, backup restore only supported within the
  same minor version.

### Changes spawned

`federation-hardening` (durable Fedify queue replacing the in-process one,
replay dedup, instance blocklist, FEDERATION.md), `link-share-tokens`
(revocable tokenized view links for private content).

### Changes updated with these findings

`route-federation` (prior-art section: Note-model contrast, interop
verdict, dual-representation consideration, hardening dependency),
`route-discovery` (prior-art section: query-layer access control,
clustering/recommendation patterns), `self-hosting-guide` (no default
secrets + boot fail-fast, rebuildable-state backup guidance,
restore-version rule). Not yet acted on: per-type notification channel
preferences (future `notifications` delta), print view with QR code,
hashed API tokens, Valhalla-style DEM elevation correction.

### Explicitly not pursued

PocketBase/SQLite single-binary direction (Postgres+PostGIS gives native
geo without a mandatory search sidecar); WASM plugin system (in-app
providers are simpler at trails' provider count); Meilisearch itself
(PostGIS + SQL covers trails' discovery scale for now).
