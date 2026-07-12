import { and, inArray, sql } from "drizzle-orm";
import { poiCategories } from "@trails-cool/map-core";
import { pois } from "@trails-cool/db/schema/planner";
import type { Route } from "./+types/api.pois";
import { getDb } from "~/lib/db.ts";
import { checkRateLimit } from "~/lib/rate-limit.ts";
import { requireSession } from "~/lib/require-session.ts";
import { poiApiRequests } from "~/lib/metrics.server.ts";

// Same per-IP budget the Overpass proxy enforced — it now protects our own
// database instead of a third-party upstream.
const RATE_LIMIT = { maxRequests: 120, windowMs: 60 * 1000 };

// Matches the former Overpass `out ... 100` cap so the client renders the
// same volume of markers per viewport.
const RESULT_CAP = 100;

const KNOWN_CATEGORY_IDS = new Set(poiCategories.map((c) => c.id));

interface PoiResult {
  id: number;
  lat: number;
  lon: number;
  name?: string;
  category: string;
  tags: Record<string, string>;
}

function bad(status: number, message: string, metric: string): Response {
  poiApiRequests.inc({ status: metric });
  return new Response(message, { status });
}

/**
 * Parse `south,west,north,east` into a validated bbox. Returns null when the
 * value is missing, malformed, out of WGS84 range, or has a non-positive
 * extent.
 */
function parseBbox(raw: string | null) {
  if (!raw) return null;
  const parts = raw.split(",").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [south, west, north, east] = parts as [number, number, number, number];
  if (south < -90 || north > 90 || west < -180 || east > 180) return null;
  if (south >= north || west >= east) return null;
  return { south, west, north, east };
}

export async function loader({ request }: Route.LoaderArgs) {
  // Same-origin defense in depth. A cross-origin browser fetch always carries
  // an Origin header (even on GET); a same-origin GET may omit it. So reject
  // only on a *mismatched* Origin, and lean on the session gate below as the
  // primary control.
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin) {
    const host = request.headers.get("x-forwarded-host") ?? requestUrl.host;
    const proto =
      request.headers.get("x-forwarded-proto") ?? requestUrl.protocol.replace(":", "");
    if (origin !== `${proto}://${host}`) {
      return bad(403, "Forbidden", "forbidden");
    }
  }

  // Session-bind: every request must present a live planner session so the
  // endpoint isn't anonymously reachable on our origin.
  const session = await requireSession(request.headers.get("x-trails-session"));
  if (session instanceof Response) {
    poiApiRequests.inc({ status: "unauthorized" });
    return session;
  }

  // Rate limit BEFORE touching the database — rejected requests never query.
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = checkRateLimit(`pois:${ip}`, RATE_LIMIT);
  if (!limit.allowed) {
    poiApiRequests.inc({ status: "rate_limited" });
    return new Response("Rate limit exceeded", {
      status: 429,
      headers: { "Retry-After": String(limit.retryAfterSeconds ?? 60) },
    });
  }

  const bbox = parseBbox(requestUrl.searchParams.get("bbox"));
  if (!bbox) return bad(400, "Invalid bbox", "bad_request");

  const requested = (requestUrl.searchParams.get("categories") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (requested.length === 0 || requested.some((c) => !KNOWN_CATEGORY_IDS.has(c))) {
    return bad(400, "Invalid categories", "bad_request");
  }

  try {
    const rows = await getDb()
      .select({
        osmId: pois.osmId,
        category: pois.category,
        name: pois.name,
        tags: pois.tags,
        lat: sql<number>`ST_Y(${pois.geom})`,
        lon: sql<number>`ST_X(${pois.geom})`,
      })
      .from(pois)
      .where(
        and(
          inArray(pois.category, requested),
          sql`${pois.geom} && ST_MakeEnvelope(${bbox.west}, ${bbox.south}, ${bbox.east}, ${bbox.north}, 4326)`,
        ),
      )
      .limit(RESULT_CAP);

    const result: PoiResult[] = rows.map((r) => ({
      id: Number(r.osmId),
      lat: r.lat,
      lon: r.lon,
      name: r.name ?? undefined,
      category: r.category,
      tags: r.tags ?? {},
    }));

    poiApiRequests.inc({ status: "ok" });
    return new Response(JSON.stringify({ pois: result }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        // Short private cache: repeated identical viewports (pan back, etc.)
        // are served from the browser cache without re-querying.
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (err) {
    // Missing table (fresh self-hosted instance) or DB outage: degrade
    // gracefully so tile overlays keep working and the map doesn't break.
    console.error("[api.pois] query failed:", err instanceof Error ? err.message : err);
    poiApiRequests.inc({ status: "error" });
    return new Response("POI service unavailable", { status: 503 });
  }
}
