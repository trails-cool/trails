import { randomUUID } from "node:crypto";
import { eq, desc } from "drizzle-orm";
import { getDb } from "./db.ts";
import { activities, routes } from "@trails-cool/db/schema/journal";
import { parseGpxAsync } from "@trails-cool/gpx";
import { setGeomFromGpx } from "./routes.server.ts";

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
  if (input.gpx) {
    try {
      const gpxData = await parseGpxAsync(input.gpx);
      distance = gpxData.distance || null;
      elevationGain = gpxData.elevation.gain;
      elevationLoss = gpxData.elevation.loss;

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
  });

  if (input.gpx) {
    await setGeomFromGpx(id, "activities", input.gpx);
  }

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
  await db.insert(routes).values({
    id: routeId,
    ownerId,
    name: `Route from: ${activity.name}`,
    description: `Created from activity "${activity.name}"`,
    gpx: activity.gpx,
    distance: activity.distance,
    elevationGain: activity.elevationGain,
    elevationLoss: activity.elevationLoss,
  });

  await setGeomFromGpx(routeId, "routes", activity.gpx);

  // Link the activity to the new route
  await db
    .update(activities)
    .set({ routeId })
    .where(eq(activities.id, activityId));

  return routeId;
}
