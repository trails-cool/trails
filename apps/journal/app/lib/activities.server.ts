import { randomUUID } from "node:crypto";
import { eq, desc } from "drizzle-orm";
import { getDb } from "./db.ts";
import { activities, routes, lineStringFromCoords } from "@trails-cool/db/schema/journal";
import { parseGpxAsync } from "@trails-cool/gpx";
import type { SQL } from "drizzle-orm";

export interface ActivityInput {
  name: string;
  description?: string;
  gpx?: string;
  routeId?: string;
}

export async function createActivity(ownerId: string, input: ActivityInput) {
  const db = getDb();
  const id = randomUUID();

  let distance: number | null = null;
  let elevationGain: number | null = null;
  let elevationLoss: number | null = null;
  let startedAt: Date | null = null;
  let geom: SQL | null = null;

  if (input.gpx) {
    try {
      const gpxData = await parseGpxAsync(input.gpx);
      const profile = gpxData.elevation.profile;
      distance = profile.length > 0 ? Math.round(profile[profile.length - 1]!.distance) : null;
      elevationGain = gpxData.elevation.gain;
      elevationLoss = gpxData.elevation.loss;

      const coords = gpxData.tracks.flat().map((p) => [p.lon, p.lat] as [number, number]);
      if (coords.length >= 2) geom = lineStringFromCoords(coords);

      // Try to extract start time from first track point
      if (gpxData.tracks[0]?.[0]?.time) {
        startedAt = new Date(gpxData.tracks[0][0].time);
      }
    } catch {
      // Continue without stats if GPX parsing fails
    }
  }

  await db.insert(activities).values({
    id,
    ownerId,
    routeId: input.routeId ?? null,
    name: input.name,
    description: input.description ?? "",
    gpx: input.gpx,
    distance,
    elevationGain,
    elevationLoss,
    startedAt,
    geom,
  });

  return id;
}

export async function getActivity(id: string) {
  const db = getDb();
  const [activity] = await db.select().from(activities).where(eq(activities.id, id));
  return activity ?? null;
}

export async function listActivities(ownerId: string) {
  const db = getDb();
  return db
    .select()
    .from(activities)
    .where(eq(activities.ownerId, ownerId))
    .orderBy(desc(activities.createdAt));
}

export async function linkActivityToRoute(activityId: string, routeId: string, _ownerId: string) {
  const db = getDb();
  await db
    .update(activities)
    .set({ routeId })
    .where(eq(activities.id, activityId));
}

export async function createRouteFromActivity(activityId: string, ownerId: string): Promise<string | null> {
  const db = getDb();
  const [activity] = await db.select().from(activities).where(eq(activities.id, activityId));
  if (!activity?.gpx) return null;

  const routeId = randomUUID();
  let routeGeom: SQL | null = null;
  if (activity.gpx) {
    try {
      const gpxData = await parseGpxAsync(activity.gpx);
      const coords = gpxData.tracks.flat().map((p) => [p.lon, p.lat] as [number, number]);
      if (coords.length >= 2) routeGeom = lineStringFromCoords(coords);
    } catch {
      // Continue without geom
    }
  }

  await db.insert(routes).values({
    id: routeId,
    ownerId,
    name: `Route from: ${activity.name}`,
    description: `Created from activity "${activity.name}"`,
    gpx: activity.gpx,
    distance: activity.distance,
    elevationGain: activity.elevationGain,
    elevationLoss: activity.elevationLoss,
    geom: routeGeom,
  });

  // Link the activity to the new route
  await db
    .update(activities)
    .set({ routeId })
    .where(eq(activities.id, activityId));

  return routeId;
}
