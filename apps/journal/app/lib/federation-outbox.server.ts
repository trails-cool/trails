// Outbox listing queries (spec 5.1). Offset-paged, public-only —
// `unlisted` and `private` never federate. Separate from
// activities.server.ts because the outbox needs raw rows (no geojson
// batching) in a stable reverse-chronological order keyed on createdAt.

import { and, count, desc, eq } from "drizzle-orm";
import { activities } from "@trails-cool/db/schema/journal";
import { getDb } from "./db.ts";
import type { FederatableActivity } from "./federation-objects.server.ts";

export const OUTBOX_PAGE_SIZE = 20;

export async function listPublicActivitiesPage(
  ownerId: string,
  offset: number,
  limit: number,
): Promise<FederatableActivity[]> {
  const db = getDb();
  return db
    .select({
      id: activities.id,
      name: activities.name,
      description: activities.description,
      distance: activities.distance,
      elevationGain: activities.elevationGain,
      duration: activities.duration,
      startedAt: activities.startedAt,
      createdAt: activities.createdAt,
    })
    .from(activities)
    .where(and(eq(activities.ownerId, ownerId), eq(activities.visibility, "public")))
    .orderBy(desc(activities.createdAt))
    .offset(offset)
    .limit(limit);
}

export async function countPublicActivities(ownerId: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ n: count() })
    .from(activities)
    .where(and(eq(activities.ownerId, ownerId), eq(activities.visibility, "public")));
  return row?.n ?? 0;
}
