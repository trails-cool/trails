# POI extract pipeline (BRouter host)

Monthly job that turns an OSM PBF into the compact POI artifact the flagship's
`planner.pois` index is built from. This is the "filter where the disk is"
half of the [`poi-index`](../../../openspec/changes/poi-index/) change — it
replaces the third-party Overpass dependency for the Planner's POI overlays.

Runs on the dedicated BRouter host (`ullrich.is`, the box with 1.8 TB free)
under the non-root `trails` user. The flagship import job
(`infrastructure/scripts/poi-import.sh`) pulls the result over the vSwitch.

## Files

| File | Role |
|------|------|
| `poi-extract.sh` | Download PBF → `osmium tags-filter` → `osmium export` → `to-ndjson.py` → gzip + manifest |
| `to-ndjson.py` | GeoJSONSeq → NDJSON, reducing ways/relations to their bbox centre (Overpass `out center` equivalent) |
| `osmium-filters.txt` | osmium tag filters, **generated** from `@trails-cool/map-core` POI selectors |
| `gen-osmium-filters.ts` | Regenerates `osmium-filters.txt` (run after changing categories) |
| `poi-extract.service` / `.timer` | systemd units (monthly) |

## Single source of truth

`osmium-filters.txt` is derived from `poiCategories` in
`packages/map-core/src/poi.ts`. After changing categories, regenerate it:

```bash
npx tsx infrastructure/brouter-host/poi-extract/gen-osmium-filters.ts
```

`packages/map-core/src/osmium-filters.sync.test.ts` fails CI if the committed
file drifts from the selectors, so the host never needs a Node runtime.

## Artifact contract

`poi-extract.sh` writes to the publish dir (default `./publish`, mounted into
the Caddy sidecar at `/srv/poi`):

- `pois.ndjson.gz` — one POI per line:
  `{osm_type, osm_id, name, lat, lon, tags}`. Category is **not** stored here;
  the flagship importer classifies each element from its `tags` using the same
  map-core selectors (so the selector logic is never duplicated on this host).
- `manifest.json` — `{artifact, sha256, row_count, generated_at, source}`.

Caddy serves both under `/poi/*` on the existing vSwitch-only `:17777`
listener, gated by the same `X-BRouter-Auth` shared secret as BRouter — so the
artifact is unreachable from the public internet.

## Prerequisites

- **Docker** — osmium runs in a container (`osmium.Dockerfile`, built on first
  use as `trails-osmium:local`). The BRouter host's `trails` user is non-root
  with no sudo, so osmium can't be apt-installed; docker-group rights cover it.
  On Linux this adds no meaningful overhead — big files are bind-mounted, so I/O
  is native.
- **On the host** (already present): `python3`, `curl`, `gzip`, `sha256sum`.

## Install the timer

Deployed under `~trails/brouter/poi-extract/`. As a user unit with lingering:

```bash
loginctl enable-linger trails
mkdir -p ~/.config/systemd/user
cp poi-extract.service poi-extract.timer ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now poi-extract.timer
systemctl --user list-timers poi-extract.timer
```

Trigger a run by hand (e.g. the first bootstrap): `systemctl --user start
poi-extract.service` then `journalctl --user -u poi-extract.service -f`.

## Footprint

- **Bandwidth**: the planet PBF is ~80 GB downloaded per run (monthly). Point
  `POI_PBF_URL` at a Geofabrik mirror or a regional/continental extract to cut
  this — e.g. `europe-latest.osm.pbf` (~30 GB) or `germany-latest.osm.pbf`
  (~4 GB) for a smaller instance.
- **Disk**: the planet PBF + filtered PBF live transiently in `./work` and are
  removed on exit (even on failure) via a trap, so peak usage ≈ the PBF size
  (tens of GB for planet). The published artifact is a few hundred MB gzipped.
  Check the host has room for one PBF before a planet run (`df -h ~`).
- **CPU/time**: a full planet filter is IO-bound and can take a few hours; the
  unit runs at `Nice=10` / idle IO priority so it doesn't disturb BRouter.

## Self-hosting

The pipeline is **optional**. A fresh instance works with an empty or absent
`planner.pois` table: `/api/pois` returns an empty result / 503 and the map's
POI panel shows "unavailable" while every other overlay and tile keeps working
— nothing breaks.

When you do want POIs, you don't need a second host or the planet. Both halves
run on one box, and `POI_PBF_URL` can point at any Geofabrik extract sized to
your region:

```bash
# Extract just your region (much smaller download, seconds not hours):
POI_PBF_URL=https://download.geofabrik.de/europe/germany-latest.osm.pbf \
  ./poi-extract.sh

# Then import it (first time: --bootstrap, since the live table is empty):
POI_ARTIFACT_BASE_URL=file-or-vswitch-url \
  ../../scripts/poi-import.sh --bootstrap
```

On a single-host instance, publish the artifact however is convenient (local
path, a static file server) and set `POI_ARTIFACT_BASE_URL` accordingly; the
two-host vSwitch topology is a flagship detail, not a requirement.

## Dry run first

Before the first planet run, validate the whole chain on a small extract:

```bash
POI_PBF_URL=https://download.geofabrik.de/europe/germany-latest.osm.pbf \
  ./poi-extract.sh
cat publish/manifest.json          # row_count sane? sha256 present?
zcat publish/pois.ndjson.gz | head # records well-formed?
zcat publish/pois.ndjson.gz | wc -l
```
