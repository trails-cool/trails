import { randomUUID } from "node:crypto";
import { eq, desc, and } from "drizzle-orm";
import { getDb } from "./db.ts";
import { routes, routeVersions } from "@trails-cool/db/schema/journal";
import { parseGpxAsync } from "@trails-cool/gpx";
import { sql } from "drizzle-orm";

export interface RouteInput {
  name: string;
  description?: string;
  gpx?: string;
  routingProfile?: string;
}

export async function createRoute(ownerId: string, input: RouteInput) {
  const db = getDb();
  const id = randomUUID();

  let distance: number | null = null;
  let elevationGain: number | null = null;
  let elevationLoss: number | null = null;
  let dayBreaks: number[] = [];
  if (input.gpx) {
    const stats = await computeRouteStats(input.gpx);
    distance = stats.distance;
    elevationGain = stats.elevationGain;
    elevationLoss = stats.elevationLoss;
    dayBreaks = stats.dayBreaks;
  }

  await db.insert(routes).values({
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
  });

  if (input.gpx) {
    await setGeomFromGpx(id, "routes", input.gpx);
  }

  // Create initial version if GPX provided
  if (input.gpx) {
    await db.insert(routeVersions).values({
      id: randomUUID(),
      routeId: id,
      version: 1,
      gpx: input.gpx,
      createdBy: ownerId,
      changeDescription: "Initial version",
    });
  }

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

  // Batch-fetch simplified GeoJSON for list thumbnails
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

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;

  if (input.gpx) {
    updateData.gpx = input.gpx;
    const stats = await computeRouteStats(input.gpx);
    updateData.distance = stats.distance;
    updateData.elevationGain = stats.elevationGain;
    updateData.elevationLoss = stats.elevationLoss;
    updateData.dayBreaks = stats.dayBreaks;

    // Get next version number
    const existingVersions = await db
      .select()
      .from(routeVersions)
      .where(eq(routeVersions.routeId, id))
      .orderBy(desc(routeVersions.version));

    const nextVersion = (existingVersions[0]?.version ?? 0) + 1;

    await db.insert(routeVersions).values({
      id: randomUUID(),
      routeId: id,
      version: nextVersion,
      gpx: input.gpx,
      createdBy: ownerId,
    });
  }

  await db
    .update(routes)
    .set(updateData)
    .where(and(eq(routes.id, id), eq(routes.ownerId, ownerId)));

  if (input.gpx) {
    await setGeomFromGpx(id, "routes", input.gpx);
  }
}

export async function deleteRoute(id: string, ownerId: string) {
  const db = getDb();
  const result = await db
    .delete(routes)
    .where(and(eq(routes.id, id), eq(routes.ownerId, ownerId)))
    .returning({ id: routes.id });
  return result.length > 0;
}

async function computeRouteStats(gpxString: string) {
  try {
    const gpxData = await parseGpxAsync(gpxString);
    const dayBreaks = gpxData.waypoints
      .map((w, i) => (w.isDayBreak ? i : -1))
      .filter((i) => i >= 0);
    return {
      distance: gpxData.distance,
      elevationGain: gpxData.elevation.gain,
      elevationLoss: gpxData.elevation.loss,
      dayBreaks,
    };
  } catch {
    return { distance: null, elevationGain: null, elevationLoss: null, dayBreaks: [] as number[] };
  }
}

async function setGeomFromGpx(id: string, table: "routes" | "activities", gpxString: string) {
  try {
    const gpxData = await parseGpxAsync(gpxString);
    const coords = gpxData.tracks.flat().map((p) => [p.lon, p.lat] as [number, number]);
    if (coords.length < 2) return;
    const geojson = JSON.stringify({ type: "LineString", coordinates: coords });
    const db = getDb();
    await db.execute(
      sql`UPDATE ${sql.identifier("journal")}.${sql.identifier(table)} SET geom = ST_GeomFromGeoJSON(${geojson}) WHERE id = ${id}`,
    );
  } catch (e) {
    console.error(`Failed to set geom for ${table}/${id}:`, e);
  }
}

export { setGeomFromGpx };

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
    // Fetch individually — Drizzle's sql template doesn't handle array params well with ANY()
    await Promise.all(ids.map(async (id) => {
      const result = await db.execute(
        sql`SELECT ST_AsGeoJSON(ST_Simplify(geom, 0.001)) as geojson FROM journal.routes WHERE id = ${id} AND geom IS NOT NULL`,
      );
      const row = (result as unknown as Array<{ geojson: string }>)[0];
      if (row?.geojson) map.set(id, row.geojson);
    }));
  } catch {
    // Fallback: no geojson
  }
  return map;
}
