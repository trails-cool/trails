// Server-side Overpass client for the surface backfill: fetches highway ways
// (with their `surface` tag + geometry) in a bbox so a route/activity can be
// map-matched. Runs only in the backfill job, never in a request path.
// Privacy: this sends the route's bounding box to the upstream Overpass — see
// route-surface-breakdown design §D5; `OVERPASS_URLS` can point at a
// self-hosted instance to keep it in-house.

export interface OverpassWay {
  highway?: string;
  surface?: string;
  /** Polyline nodes, in order. */
  geometry: Array<{ lat: number; lon: number }>;
}

export interface Bbox {
  south: number;
  west: number;
  north: number;
  east: number;
}

const DEFAULT_UPSTREAMS = [
  "https://lz4.overpass-api.de/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];

function upstreams(): string[] {
  const env = process.env.OVERPASS_URLS ?? process.env.OVERPASS_URL;
  return env ? env.split(",").map((s) => s.trim()).filter(Boolean) : DEFAULT_UPSTREAMS;
}

// Skip absurdly large bboxes — Overpass would time out / return too much, and a
// huge box means the route is so long that per-segment matching is unreliable
// anyway. ~0.25 deg² (roughly a 50 km square at mid latitudes).
const MAX_BBOX_DEG2 = 0.25;
const USER_AGENT = "trails.cool Journal (https://trails.cool; legal@trails.cool)";

/**
 * Fetch highway ways within `bbox`. Returns `[]` for an empty/oversized bbox
 * (caller treats that as "no data, don't store"); throws if every upstream
 * fails so the job retries.
 */
export async function fetchWaysInBbox(
  bbox: Bbox,
  opts: { timeoutMs?: number } = {},
): Promise<OverpassWay[]> {
  const area = Math.abs(bbox.north - bbox.south) * Math.abs(bbox.east - bbox.west);
  if (!(area > 0) || area > MAX_BBOX_DEG2) return [];

  const query = `[out:json][timeout:25];way["highway"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});out tags geom;`;
  const timeoutMs = opts.timeoutMs ?? 30_000;

  let lastError: unknown;
  for (const url of upstreams()) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain", "User-Agent": USER_AGENT },
        body: query,
        signal: controller.signal,
      });
      if (!resp.ok) {
        lastError = new Error(`overpass ${resp.status}`);
        continue;
      }
      const json = (await resp.json()) as {
        elements?: Array<{ type: string; tags?: Record<string, string>; geometry?: Array<{ lat: number; lon: number }> }>;
      };
      const ways: OverpassWay[] = [];
      for (const el of json.elements ?? []) {
        if (el.type !== "way" || !el.geometry || el.geometry.length < 2) continue;
        ways.push({ highway: el.tags?.highway, surface: el.tags?.surface, geometry: el.geometry });
      }
      return ways;
    } catch (e) {
      lastError = e;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`overpass: all upstreams failed (${(lastError as Error)?.message ?? "unknown"})`);
}
