import { randomUUID } from "node:crypto";
import { eq, desc, and, isNotNull, sql } from "drizzle-orm";
import { unionAll } from "drizzle-orm/pg-core";
import { getDb } from "./db.ts";
import { activities, routes, syncImports, users, follows, remoteActors } from "@trails-cool/db/schema/journal";
import type { Visibility } from "@trails-cool/db/schema/journal";
import { processGpx, writeGeom } from "./gpx-save.server.ts";
import type { ProcessedGpx } from "./gpx-save.server.ts";
import { enqueueOptional } from "./boss.server.ts";
import type { OwnedRef } from "./ownership.server.ts";
import {
  enqueueActivityDeliveries,
  visibilityTransitionAction,
} from "./federation-delivery.server.ts";

export interface ActivityInput {
  name: string;
  description?: string;
  gpx?: string;
  routeId?: string;
  distance?: number | null;
  duration?: number | null;
  startedAt?: Date | null;
  visibility?: Visibility;
  synthetic?: boolean;
}

export async function updateActivityVisibility(
  ownedActivity: OwnedRef,
  visibility: Visibility,
): Promise<boolean> {
  const { id, ownerId } = ownedActivity;
  const db = getDb();
  // Read the previous visibility first: the federation action depends on
  // the *transition*, not the new value alone (a gratuitous Delete
  // permanently tombstones the object's URI on Mastodon — see
  // visibilityTransitionAction).
  const [existing] = await db
    .select({ visibility: activities.visibility })
    .from(activities)
    .where(and(eq(activities.id, id), eq(activities.ownerId, ownerId)))
    .limit(1);
  if (!existing) return false;

  await db
    .update(activities)
    .set({ visibility })
    .where(and(eq(activities.id, id), eq(activities.ownerId, ownerId)));

  // Notify followers when an activity becomes public. The unique
  // (recipient, type, subject_id) partial index makes the fan-out
  // idempotent, so toggling private→public→private→public won't spam
  // followers (only the first transition per activity emits).
  if (visibility === "public") {
    await enqueueOptional("notifications-fanout", { activityId: id }, { source: "updateActivityVisibility" });
  }

  // Federation: Create on (re-)publish, Delete(Tombstone) only when the
  // activity actually was public before — remotes never saw anything
  // else, and an unnecessary Delete poisons the URI forever.
  const action = visibilityTransitionAction(existing.visibility, visibility);
  if (action !== null) {
    await enqueueActivityDeliveries(ownerId, id, action);
  }

  return true;
}

export async function createActivity(ownerId: string, input: ActivityInput) {
  const db = getDb();
  const id = randomUUID();

  let processed: ProcessedGpx | null = null;
  let distance: number | null = input.distance ?? null;
  let elevationGain: number | null = null;
  let elevationLoss: number | null = null;
  let startedAt: Date | null = input.startedAt ?? null;
  const duration: number | null = input.duration ?? null;

  if (input.gpx) {
    processed = await processGpx(input.gpx);
    // GPX-derived distance wins unless it is zero; caller input is the fallback
    distance = processed.stats.distance || distance;
    elevationGain = processed.stats.elevationGain;
    elevationLoss = processed.stats.elevationLoss;
    startedAt = startedAt ?? processed.stats.startTime;
  }

  await db.transaction(async (tx) => {
    await tx.insert(activities).values({
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
      ...(input.visibility ? { visibility: input.visibility } : {}),
      ...(input.synthetic ? { synthetic: true } : {}),
    });

    if (input.gpx && processed) {
      await writeGeom(tx, id, "activities", processed.coords);
    }
  });

  // Public activities at creation also fan out (matches the
  // updateActivityVisibility path for the case where visibility is set
  // up-front rather than flipped later).
  if (input.visibility === "public") {
    await enqueueOptional("notifications-fanout", { activityId: id }, { source: "createActivity" });
    // Federation push delivery to accepted remote followers (spec 5.3).
    await enqueueActivityDeliveries(ownerId, id, "create");
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

export async function deleteActivity(ownedActivity: OwnedRef): Promise<boolean> {
  const { id, ownerId } = ownedActivity;
  const db = getDb();
  // The WHERE ownerId clause stays as defense in depth even though the
  // OwnedRef brand already proves ownership.
  const [activity] = await db.select({ id: activities.id, visibility: activities.visibility }).from(activities)
    .where(and(eq(activities.id, id), eq(activities.ownerId, ownerId)));
  if (!activity) return false;
  // Enqueue the federation retraction *before* the row disappears —
  // the Delete payload carries everything it needs (object IRI +
  // owner), so it survives the deletion (spec 5.6).
  if (activity.visibility === "public") {
    await enqueueActivityDeliveries(ownerId, id, "delete");
  }
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

export async function listActivities(
  ownerId: string,
  sort: "startedAt" | "addedAt" = "startedAt",
) {
  const db = getDb();
  const order = sort === "addedAt" ? desc(activities.createdAt) : desc(activities.startedAt);
  const rows = await db
    .select()
    .from(activities)
    .where(eq(activities.ownerId, ownerId))
    .orderBy(order);

  const ids = rows.map((r) => r.id);
  const geojsonMap = ids.length > 0 ? await getSimplifiedActivityGeojsonBatch(ids) : new Map();
  return rows.map((r) => ({ ...r, geojson: geojsonMap.get(r.id) ?? null }));
}

/**
 * List the *public* activities of a given owner. Used for cross-user
 * listings (the public profile page); never includes `unlisted` or
 * `private` content.
 */
export async function listPublicActivitiesForOwner(
  ownerId: string,
  sort: "startedAt" | "addedAt" = "startedAt",
  limit: number = 100,
) {
  const db = getDb();
  const order = sort === "addedAt" ? desc(activities.createdAt) : desc(activities.startedAt);
  const rows = await db
    .select()
    .from(activities)
    .where(and(eq(activities.ownerId, ownerId), eq(activities.visibility, "public")))
    .orderBy(order)
    .limit(limit);

  const ids = rows.map((r) => r.id);
  const geojsonMap = ids.length > 0 ? await getSimplifiedActivityGeojsonBatch(ids) : new Map();
  return rows.map((r) => ({ ...r, geojson: geojsonMap.get(r.id) ?? null }));
}

/**
 * Social feed (spec: social-federation §8): aggregated activities from
 * actors that `followerId` follows with an *accepted* follow — local
 * users and remote trails actors alike. Reverse-chronological on
 * COALESCE(remote_published_at, created_at).
 *
 * Audience rules:
 * - local rows: `visibility = 'public'` only (unlisted/private never
 *   appear regardless of follow state)
 * - remote rows: `audience = 'public'` or `followers-only` — the
 *   latter gated structurally by joining the *viewer's own* accepted
 *   follow against the originating actor (spec: "Followers-only remote
 *   content reaches only the right viewer")
 * Pending follows contribute nothing (accepted_at IS NOT NULL on both
 * branches — previously missing on the local branch).
 */
export async function listSocialFeed(followerId: string, limit: number = 50) {
  const db = getDb();

  const local = db
    .select({
      id: activities.id,
      name: activities.name,
      distance: activities.distance,
      elevationGain: activities.elevationGain,
      duration: activities.duration,
      startedAt: activities.startedAt,
      createdAt: activities.createdAt,
      sortTime: sql<Date>`${activities.createdAt}`.as("sort_time"),
      ownerUsername: sql<string | null>`${users.username}`.as("owner_username"),
      ownerDisplayName: sql<string | null>`${users.displayName}`.as("owner_display_name"),
      ownerDomain: sql<string | null>`${users.domain}`.as("owner_domain"),
      externalUrl: sql<string | null>`NULL`.as("external_url"),
      remote: sql<boolean>`false`.as("remote"),
    })
    .from(activities)
    .innerJoin(follows, eq(follows.followedUserId, activities.ownerId))
    .innerJoin(users, eq(activities.ownerId, users.id))
    .where(
      and(
        eq(follows.followerId, followerId),
        isNotNull(follows.acceptedAt),
        eq(activities.visibility, "public"),
      ),
    );

  const remote = db
    .select({
      id: activities.id,
      name: activities.name,
      distance: activities.distance,
      elevationGain: activities.elevationGain,
      duration: activities.duration,
      startedAt: activities.startedAt,
      createdAt: activities.createdAt,
      sortTime: sql<Date>`COALESCE(${activities.remotePublishedAt}, ${activities.createdAt})`.as("sort_time"),
      ownerUsername: sql<string | null>`${remoteActors.username}`.as("owner_username"),
      ownerDisplayName: sql<string | null>`${remoteActors.displayName}`.as("owner_display_name"),
      ownerDomain: sql<string | null>`${remoteActors.domain}`.as("owner_domain"),
      externalUrl: sql<string | null>`${activities.remoteOriginIri}`.as("external_url"),
      remote: sql<boolean>`true`.as("remote"),
    })
    .from(activities)
    .innerJoin(follows, eq(follows.followedActorIri, activities.remoteActorIri))
    .leftJoin(remoteActors, eq(activities.remoteActorIri, remoteActors.actorIri))
    .where(
      and(
        eq(follows.followerId, followerId),
        isNotNull(follows.acceptedAt),
        // public reaches every accepted follower; followers-only is
        // already gated by joining the viewer's own accepted follow.
        sql`${activities.audience} IN ('public', 'followers-only')`,
      ),
    );

  const rows = await unionAll(local, remote)
    .orderBy(sql`sort_time DESC`)
    .limit(limit);

  const localIds = rows.filter((r) => !r.remote).map((r) => r.id);
  const geojsonMap = localIds.length > 0 ? await getSimplifiedActivityGeojsonBatch(localIds) : new Map();
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

export async function linkActivityToRoute(ownedActivity: OwnedRef, ownedRoute: OwnedRef) {
  const db = getDb();
  await db
    .update(activities)
    .set({ routeId: ownedRoute.id })
    .where(and(eq(activities.id, ownedActivity.id), eq(activities.ownerId, ownedActivity.ownerId)));
}

export async function createRouteFromActivity(ownedActivity: OwnedRef): Promise<string | null> {
  const { id: activityId, ownerId } = ownedActivity;
  const db = getDb();
  const [activity] = await db
    .select()
    .from(activities)
    .where(and(eq(activities.id, activityId), eq(activities.ownerId, ownerId)));
  if (!activity?.gpx) return null;

  const { coords } = await processGpx(activity.gpx);
  const routeId = randomUUID();

  await db.transaction(async (tx) => {
    await tx.insert(routes).values({
      id: routeId,
      ownerId,
      name: `Route from: ${activity.name}`,
      description: `Created from activity "${activity.name}"`,
      gpx: activity.gpx,
      distance: activity.distance,
      elevationGain: activity.elevationGain,
      elevationLoss: activity.elevationLoss,
    });

    await writeGeom(tx, routeId, "routes", coords);

    await tx.update(activities).set({ routeId }).where(eq(activities.id, activityId));
  });

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
    const result = await db.execute(
      sql`SELECT id, ST_AsGeoJSON(ST_Simplify(geom, 0.001)) as geojson
          FROM journal.activities
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
