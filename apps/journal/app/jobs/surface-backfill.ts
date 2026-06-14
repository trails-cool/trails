import { sql } from "drizzle-orm";
import { defineJournalJob } from "./payloads.ts";
import { getDb } from "../lib/db.ts";
import { computeSurfaceBreakdown } from "@trails-cool/map-core";
import { fetchWaysInBbox, type Bbox } from "../lib/overpass-ways.server.ts";
import { matchSurfaces } from "../lib/surface-match.server.ts";
import { emitTo } from "../lib/events.server.ts";
import { logger } from "../lib/logger.server.ts";

// Cap coordinates fed to the matcher; the breakdown still weights by the actual
// segment length, so downsampling barely shifts proportions.
const MAX_COORDS = 250;
const BBOX_PAD_DEG = 0.0008; // ~80 m, so ways just off the line are considered

/**
 * Derive a surface/waytype breakdown for a route/activity that has geometry but
 * no breakdown yet (imports, uploads, pre-existing rows), by map-matching its
 * geometry to OSM ways via Overpass. Idempotent (skips if already set),
 * best-effort (Overpass failure throws → pg-boss retries; an empty/oversized
 * bbox is a no-op). On success it stores the breakdown and pushes an SSE event
 * to the owner so an open detail page fills the bars in live.
 */
export const surfaceBackfillJob = defineJournalJob({
  name: "surface-backfill",
  retryLimit: 3,
  expireInSeconds: 120,
  async handler(job) {
    const batch = Array.isArray(job) ? job : [job];
    for (const item of batch) {
      await runSurfaceBackfill(item.data.kind, item.data.id);
    }
  },
});

export async function runSurfaceBackfill(kind: "route" | "activity", id: string): Promise<void> {
  const db = getDb();
  const tableName = kind === "route" ? sql`journal.routes` : sql`journal.activities`;

  const loaded = (await db.execute(sql`
    SELECT ST_AsGeoJSON(geom) AS geojson,
           owner_id AS "ownerId",
           (surface_breakdown IS NOT NULL) AS "hasBreakdown"
    FROM ${tableName} WHERE id = ${id} LIMIT 1
  `)) as unknown as Array<{ geojson: string | null; ownerId: string | null; hasBreakdown: boolean }>;
  const row = loaded[0];

  if (!row) {
    logger.warn({ kind, id }, "surface-backfill: row not found");
    return;
  }
  if (row.hasBreakdown) return; // idempotent
  if (!row.geojson) return; // no geometry to match

  let coords: number[][];
  try {
    coords = (JSON.parse(row.geojson) as { coordinates?: number[][] }).coordinates ?? [];
  } catch {
    return;
  }
  if (coords.length < 2) return;

  if (coords.length > MAX_COORDS) {
    const stride = Math.ceil(coords.length / MAX_COORDS);
    const out: number[][] = [];
    for (let i = 0; i < coords.length; i += stride) out.push(coords[i]!);
    const last = coords[coords.length - 1]!;
    if (out[out.length - 1] !== last) out.push(last);
    coords = out;
  }

  let south = coords[0]![1]!, north = south, west = coords[0]![0]!, east = west;
  for (const c of coords) {
    const lon = c[0]!, lat = c[1]!;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
    if (lon < west) west = lon;
    if (lon > east) east = lon;
  }
  const bbox: Bbox = {
    south: south - BBOX_PAD_DEG,
    west: west - BBOX_PAD_DEG,
    north: north + BBOX_PAD_DEG,
    east: east + BBOX_PAD_DEG,
  };

  const ways = await fetchWaysInBbox(bbox);
  if (ways.length === 0) {
    logger.info({ kind, id }, "surface-backfill: no ways (bbox empty/oversized) — skipping");
    return;
  }

  const { surfaces, highways } = matchSurfaces(coords, ways);
  const breakdown = computeSurfaceBreakdown(coords, surfaces, highways);
  if (Object.keys(breakdown.surface).length === 0 && Object.keys(breakdown.highway).length === 0) return;

  await db.execute(sql`
    UPDATE ${tableName} SET surface_breakdown = ${JSON.stringify(breakdown)}::jsonb WHERE id = ${id}
  `);
  if (row.ownerId) emitTo(row.ownerId, "surface_breakdown", { kind, id });
  logger.info({ kind, id }, "surface-backfill: stored breakdown");
}
