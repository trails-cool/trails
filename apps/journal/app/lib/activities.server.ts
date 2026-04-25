import { randomUUID } from "node:crypto";
import { eq, desc, and, sql } from "drizzle-orm";
import { getDb } from "./db.ts";
import { activities, routes, syncImports, users, follows } from "@trails-cool/db/schema/journal";
import type { Visibility } from "@trails-cool/db/schema/journal";
import { parseGpxAsync } from "@trails-cool/gpx";
import { setGeomFromGpx } from "./routes.server.ts";

export interface ActivityInput {
  name: string;
  description?: string;
  gpx?: string;
  routeId?: string;
  distance?: number | null;
  duration?: number | null;
  startedAt?: Date | null;
  visibility?: Visibility;
}

export async function updateActivityVisibility(
  id: string,
  ownerId: string,
  visibility: Visibility,
): Promise<boolean> {
  const db = getDb();
  const result = await db
    .update(activities)
    .set({ visibility })
    .where(and(eq(activities.id, id), eq(activities.ownerId, ownerId)))
    .returning({ id: activities.id });
  return result.length > 0;
}

export async function createActivity(ownerId: string, input: ActivityInput) {
  const db = getDb();
  const id = randomUUID();

  let distance: number | null = input.distance ?? null;
  let elevationGain: number | null = null;
  let elevationLoss: number | null = null;
  let startedAt: Date | null = input.startedAt ?? null;
  const duration: number | null = input.duration ?? null;
  if (input.gpx) {
    try {
      const gpxData = await parseGpxAsync(input.gpx);
      distance = gpxData.distance || distance;
      elevationGain = gpxData.elevation.gain;
      elevationLoss = gpxData.elevation.loss;

      if (!startedAt && gpxData.tracks[0]?.[0]?.time) {
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
    duration,
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
  if (!activity) return null;
  const geojson = await getActivityGeojson(id);
  const importSource = await getImportSource(id);
  return { ...activity, geojson, importSource };
}

export async function deleteActivity(id: string, ownerId: string): Promise<boolean> {
  const db = getDb();
  const [activity] = await db.select({ id: activities.id }).from(activities)
    .where(and(eq(activities.id, id), eq(activities.ownerId, ownerId)));
  if (!activity) return false;
  await db.delete(activities).where(eq(activities.id, id));
  return true;
}

async function getImportSource(activityId: string): Promise<{ provider: string; externalWorkoutId: string } | null> {
  const db = getDb();
  const [row] = await db
    .select({ provider: syncImports.provider, externalWorkoutId: syncImports.externalWorkoutId })
    .from(syncImports)
    .where(eq(syncImports.activityId, activityId));
  return row ?? null;
}

export async function listActivities(ownerId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(activities)
    .where(eq(activities.ownerId, ownerId))
    .orderBy(desc(activities.createdAt));

  const ids = rows.map((r) => r.id);
  const geojsonMap = ids.length > 0 ? await getSimplifiedActivityGeojsonBatch(ids) : new Map();
  return rows.map((r) => ({ ...r, geojson: geojsonMap.get(r.id) ?? null }));
}

/**
 * List the *public* activities of a given owner. Used for cross-user
 * listings (the public profile page); never includes `unlisted` or
 * `private` content.
 */
export async function listPublicActivitiesForOwner(ownerId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(activities)
    .where(and(eq(activities.ownerId, ownerId), eq(activities.visibility, "public")))
    .orderBy(desc(activities.createdAt));

  const ids = rows.map((r) => r.id);
  const geojsonMap = ids.length > 0 ? await getSimplifiedActivityGeojsonBatch(ids) : new Map();
  return rows.map((r) => ({ ...r, geojson: geojsonMap.get(r.id) ?? null }));
}

/**
 * Social feed: aggregated public activities from users that `followerId`
 * follows (accepted only). Reverse-chronological. Joins users for owner
 * attribution. Unlisted/private activities never appear, regardless of
 * follow state.
 */
export async function listSocialFeed(followerId: string, limit: number = 50) {
  const db = getDb();
  const rows = await db
    .select({
      id: activities.id,
      name: activities.name,
      distance: activities.distance,
      elevationGain: activities.elevationGain,
      duration: activities.duration,
      startedAt: activities.startedAt,
      createdAt: activities.createdAt,
      ownerUsername: users.username,
      ownerDisplayName: users.displayName,
    })
    .from(activities)
    .innerJoin(follows, eq(follows.followedUserId, activities.ownerId))
    .innerJoin(users, eq(activities.ownerId, users.id))
    .where(
      and(
        eq(follows.followerId, followerId),
        eq(activities.visibility, "public"),
      ),
    )
    .orderBy(desc(activities.createdAt))
    .limit(limit);

  const ids = rows.map((r) => r.id);
  const geojsonMap = ids.length > 0 ? await getSimplifiedActivityGeojsonBatch(ids) : new Map();
  return rows.map((r) => ({ ...r, geojson: geojsonMap.get(r.id) ?? null }));
}

/**
 * Instance-wide public activity feed. Joins users so the caller can
 * render "by <displayName>" without a second round-trip. Used by the
 * Journal home to give arriving visitors something concrete to look at.
 * Unlisted activities are excluded: they're reachable by direct URL
 * only and shouldn't surface in any listing.
 */
export async function listRecentPublicActivities(limit: number = 20) {
  const db = getDb();
  const rows = await db
    .select({
      id: activities.id,
      name: activities.name,
      distance: activities.distance,
      elevationGain: activities.elevationGain,
      duration: activities.duration,
      startedAt: activities.startedAt,
      createdAt: activities.createdAt,
      ownerUsername: users.username,
      ownerDisplayName: users.displayName,
    })
    .from(activities)
    .innerJoin(users, eq(activities.ownerId, users.id))
    .where(eq(activities.visibility, "public"))
    .orderBy(desc(activities.createdAt))
    .limit(limit);

  const ids = rows.map((r) => r.id);
  const geojsonMap = ids.length > 0 ? await getSimplifiedActivityGeojsonBatch(ids) : new Map();
  return rows.map((r) => ({ ...r, geojson: geojsonMap.get(r.id) ?? null }));
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

async function getActivityGeojson(id: string): Promise<string | null> {
  try {
    const db = getDb();
    const result = await db.execute(
      sql`SELECT ST_AsGeoJSON(geom) as geojson FROM journal.activities WHERE id = ${id} AND geom IS NOT NULL`,
    );
    const row = (result as unknown as Array<{ geojson: string }>)[0];
    return row?.geojson ?? null;
  } catch {
    return null;
  }
}

async function getSimplifiedActivityGeojsonBatch(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  try {
    const db = getDb();
    await Promise.all(ids.map(async (id) => {
      const result = await db.execute(
        sql`SELECT ST_AsGeoJSON(ST_Simplify(geom, 0.001)) as geojson FROM journal.activities WHERE id = ${id} AND geom IS NOT NULL`,
      );
      const row = (result as unknown as Array<{ geojson: string }>)[0];
      if (row?.geojson) map.set(id, row.geojson);
    }));
  } catch {
    // Fallback: no geojson
  }
  return map;
}
