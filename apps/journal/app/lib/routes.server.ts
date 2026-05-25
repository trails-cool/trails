import { randomUUID } from "node:crypto";
import { eq, desc, and } from "drizzle-orm";
import { getDb } from "./db.ts";
import { routes, routeVersions } from "@trails-cool/db/schema/journal";
import type { Visibility } from "@trails-cool/db/schema/journal";
import { sql } from "drizzle-orm";
import { validateGpx, writeGeom } from "./gpx-save.server.ts";
import type { GpxData } from "./gpx-save.server.ts";

export interface RouteInput {
  name: string;
  description?: string;
  gpx?: string;
  routingProfile?: string;
  visibility?: Visibility;
  // Pre-computed stats — when provided, skip re-parsing (used by demo-bot)
  distance?: number | null;
  elevationGain?: number | null;
  elevationLoss?: number | null;
  dayBreaks?: number[];
  synthetic?: boolean;
}

export async function createRoute(ownerId: string, input: RouteInput) {
  const db = getDb();
  const id = randomUUID();

  let parsed: GpxData | null = null;
  let distance: number | null = input.distance ?? null;
  let elevationGain: number | null = input.elevationGain ?? null;
  let elevationLoss: number | null = input.elevationLoss ?? null;
  let dayBreaks: number[] = input.dayBreaks ?? [];

  if (input.gpx) {
    parsed = await validateGpx(input.gpx);
    // Only compute stats from GPX if not pre-supplied by caller
    if (input.distance === undefined) {
      const stats = computeRouteStats(parsed);
      distance = stats.distance;
      elevationGain = stats.elevationGain;
      elevationLoss = stats.elevationLoss;
      dayBreaks = stats.dayBreaks;
    }
  }

  await db.transaction(async (tx) => {
    await tx.insert(routes).values({
      id,
      ownerId,
      name: input.name,
      description: input.description ?? "",
      gpx: input.gpx,
      routingProfile: input.routingProfile,
      distance,
      elevationGain,
      elevationLoss,
      dayBreaks,
      ...(input.visibility ? { visibility: input.visibility } : {}),
      ...(input.synthetic ? { synthetic: true } : {}),
    });

    if (input.gpx && parsed) {
      const coords = parsed.tracks.flat().map((p) => [p.lon, p.lat] as [number, number]);
      await writeGeom(tx, id, "routes", coords);

      await tx.insert(routeVersions).values({
        id: randomUUID(),
        routeId: id,
        version: 1,
        gpx: input.gpx,
        createdBy: ownerId,
        changeDescription: "Initial version",
      });
    }
  });

  return id;
}

export async function getRoute(id: string) {
  const db = getDb();
  const [route] = await db.select().from(routes).where(eq(routes.id, id));
  if (!route) return null;
  const geojson = await getGeojson("routes", id);
  return { ...route, geojson };
}

export async function getRouteWithVersions(id: string) {
  const db = getDb();
  const [route] = await db.select().from(routes).where(eq(routes.id, id));
  if (!route) return null;

  const versions = await db
    .select()
    .from(routeVersions)
    .where(eq(routeVersions.routeId, id))
    .orderBy(desc(routeVersions.version));

  return { ...route, versions };
}

export async function listRoutes(ownerId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(routes)
    .where(eq(routes.ownerId, ownerId))
    .orderBy(desc(routes.updatedAt));

  const ids = rows.map((r) => r.id);
  const geojsonMap = ids.length > 0 ? await getSimplifiedGeojsonBatch(ids) : new Map();
  return rows.map((r) => ({ ...r, geojson: geojsonMap.get(r.id) ?? null }));
}

/**
 * List the *public* routes of a given owner. Used for cross-user listings
 * (the public profile page); never includes `unlisted` or `private` content.
 */
export async function listPublicRoutesForOwner(ownerId: string, limit: number = 100) {
  const db = getDb();
  const rows = await db
    .select()
    .from(routes)
    .where(and(eq(routes.ownerId, ownerId), eq(routes.visibility, "public")))
    .orderBy(desc(routes.updatedAt))
    .limit(limit);

  const ids = rows.map((r) => r.id);
  const geojsonMap = ids.length > 0 ? await getSimplifiedGeojsonBatch(ids) : new Map();
  return rows.map((r) => ({ ...r, geojson: geojsonMap.get(r.id) ?? null }));
}

export async function updateRoute(
  id: string,
  ownerId: string,
  input: Partial<RouteInput>,
) {
  const db = getDb();

  let parsed: GpxData | null = null;
  if (input.gpx) {
    parsed = await validateGpx(input.gpx);
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.visibility !== undefined) updateData.visibility = input.visibility;

  if (input.gpx && parsed) {
    const stats = computeRouteStats(parsed);
    updateData.gpx = input.gpx;
    updateData.distance = stats.distance;
    updateData.elevationGain = stats.elevationGain;
    updateData.elevationLoss = stats.elevationLoss;
    updateData.dayBreaks = stats.dayBreaks;
    if (stats.description && input.description === undefined) {
      updateData.description = stats.description;
    }
  }

  await db.transaction(async (tx) => {
    await tx
      .update(routes)
      .set(updateData)
      .where(and(eq(routes.id, id), eq(routes.ownerId, ownerId)));

    if (input.gpx && parsed) {
      const coords = parsed.tracks.flat().map((p) => [p.lon, p.lat] as [number, number]);
      await writeGeom(tx, id, "routes", coords);

      const existingVersions = await tx
        .select()
        .from(routeVersions)
        .where(eq(routeVersions.routeId, id))
        .orderBy(desc(routeVersions.version));

      const nextVersion = (existingVersions[0]?.version ?? 0) + 1;

      await tx.insert(routeVersions).values({
        id: randomUUID(),
        routeId: id,
        version: nextVersion,
        gpx: input.gpx,
        createdBy: ownerId,
      });
    }
  });
}

export async function deleteRoute(id: string, ownerId: string) {
  const db = getDb();
  const result = await db
    .delete(routes)
    .where(and(eq(routes.id, id), eq(routes.ownerId, ownerId)))
    .returning({ id: routes.id });
  return result.length > 0;
}

function computeRouteStats(gpxData: GpxData) {
  const dayBreaks = gpxData.waypoints
    .map((w, i) => (w.isDayBreak ? i : -1))
    .filter((i) => i >= 0);
  return {
    distance: gpxData.distance,
    elevationGain: gpxData.elevation.gain,
    elevationLoss: gpxData.elevation.loss,
    dayBreaks,
    description: gpxData.description,
  };
}

async function getGeojson(table: "routes" | "activities", id: string): Promise<string | null> {
  try {
    const db = getDb();
    const result = await db.execute(
      sql`SELECT ST_AsGeoJSON(geom) as geojson FROM ${sql.identifier("journal")}.${sql.identifier(table)} WHERE id = ${id} AND geom IS NOT NULL`,
    );
    const row = (result as unknown as Array<{ geojson: string }>)[0];
    return row?.geojson ?? null;
  } catch {
    return null;
  }
}

async function getSimplifiedGeojsonBatch(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  try {
    const db = getDb();
    const result = await db.execute(
      sql`SELECT id, ST_AsGeoJSON(ST_Simplify(geom, 0.001)) as geojson
          FROM journal.routes
          WHERE id = ANY(${ids}::text[]) AND geom IS NOT NULL`,
    );
    for (const row of result as unknown as Array<{ id: string; geojson: string }>) {
      if (row.geojson) map.set(row.id, row.geojson);
    }
  } catch {
    // Fallback: no geojson
  }
  return map;
}
