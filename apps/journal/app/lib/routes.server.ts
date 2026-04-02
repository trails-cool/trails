import { randomUUID } from "node:crypto";
import { eq, desc, and } from "drizzle-orm";
import { getDb } from "./db.ts";
import { routes, routeVersions, lineStringFromCoords } from "@trails-cool/db/schema/journal";
import { parseGpx } from "@trails-cool/gpx";
import type { SQL } from "drizzle-orm";

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
  let geom: SQL | null = null;

  if (input.gpx) {
    const stats = computeRouteStats(input.gpx);
    distance = stats.distance;
    elevationGain = stats.elevationGain;
    elevationLoss = stats.elevationLoss;
    geom = stats.geom;
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
    geom,
  });

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
  return route ?? null;
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
  return db
    .select()
    .from(routes)
    .where(eq(routes.ownerId, ownerId))
    .orderBy(desc(routes.updatedAt));
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
    const stats = computeRouteStats(input.gpx);
    updateData.distance = stats.distance;
    updateData.elevationGain = stats.elevationGain;
    updateData.elevationLoss = stats.elevationLoss;
    updateData.geom = stats.geom;

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
}

export async function deleteRoute(id: string, ownerId: string) {
  const db = getDb();
  const result = await db
    .delete(routes)
    .where(and(eq(routes.id, id), eq(routes.ownerId, ownerId)))
    .returning({ id: routes.id });
  return result.length > 0;
}

function computeRouteStats(gpxString: string) {
  try {
    const gpxData = parseGpx(gpxString);
    const coords = gpxData.tracks.flat().map((p) => [p.lon, p.lat] as [number, number]);
    return {
      distance: Math.round(
        gpxData.elevation.profile.length > 0
          ? gpxData.elevation.profile[gpxData.elevation.profile.length - 1]!.distance
          : 0,
      ),
      elevationGain: gpxData.elevation.gain,
      elevationLoss: gpxData.elevation.loss,
      geom: coords.length >= 2 ? lineStringFromCoords(coords) : null,
    };
  } catch {
    return { distance: null, elevationGain: null, elevationLoss: null, geom: null };
  }
}
