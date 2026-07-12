#!/usr/bin/env python3
"""Transform osmium's GeoJSONSeq output into the compact POI artifact.

Reads a GeoJSON Feature per line on stdin (as produced by
`osmium export -f geojsonseq --add-unique-id=type_id`) and writes one NDJSON
object per line on stdout:

    {"osm_type": "n", "osm_id": "123", "name": "Brunnen",
     "lat": 52.52, "lon": 13.40, "tags": {"amenity": "drinking_water", ...}}

Ways and relations are reduced to the centre of their bounding box — the same
representative point Overpass returned for `out center`, so markers land where
they used to. Category classification is intentionally NOT done here: the
flagship importer derives categories from the tags using the map-core
selectors (the single source of truth), so this host stays Node-free and the
selector logic is never duplicated.
"""
import json
import sys


def coords(geometry):
    """Yield every (lon, lat) pair in a GeoJSON geometry, any type."""
    def walk(node):
        if (
            isinstance(node, list)
            and len(node) == 2
            and all(isinstance(n, (int, float)) for n in node)
        ):
            yield node
        elif isinstance(node, list):
            for child in node:
                yield from walk(child)

    yield from walk(geometry.get("coordinates", []))


def bbox_center(geometry):
    """Bounding-box centre of a geometry, matching Overpass `out center`."""
    pts = list(coords(geometry))
    if not pts:
        return None
    lons = [p[0] for p in pts]
    lats = [p[1] for p in pts]
    return (min(lons) + max(lons)) / 2, (min(lats) + max(lats)) / 2


def main():
    written = 0
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        feature = json.loads(line)
        geometry = feature.get("geometry") or {}
        center = bbox_center(geometry)
        if center is None:
            continue
        lon, lat = center

        props = feature.get("properties") or {}
        # osmium `--add-unique-id=type_id` emits ids like "n123", "w456",
        # "r789" under the `id` / `@id` key depending on version.
        raw_id = str(feature.get("id") or props.get("@id") or props.get("id") or "")
        if not raw_id or raw_id[0] not in "nwr":
            continue
        osm_type, osm_id = raw_id[0], raw_id[1:]

        # Tags are the feature properties minus osmium's synthetic id keys.
        tags = {k: v for k, v in props.items() if k not in ("@id", "id")}

        json.dump(
            {
                "osm_type": osm_type,
                "osm_id": osm_id,
                "name": tags.get("name"),
                "lat": round(lat, 7),
                "lon": round(lon, 7),
                "tags": tags,
            },
            sys.stdout,
            ensure_ascii=False,
            separators=(",", ":"),
        )
        sys.stdout.write("\n")
        written += 1

    # Row count to stderr so the caller can record it in the manifest.
    print(written, file=sys.stderr)


if __name__ == "__main__":
    main()
