import { randomUUID } from "node:crypto";
import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "../db.ts";
import { syncImports } from "@trails-cool/db/schema/journal";
import { createActivity } from "../activities.server.ts";
import type { SportType } from "@trails-cool/db/schema/journal";

export async function recordImport(
  userId: string,
  provider: string,
  externalWorkoutId: string,
  activityId: string,
) {
  const db = getDb();
  await db.insert(syncImports).values({
    id: randomUUID(),
    userId,
    provider,
    externalWorkoutId,
    activityId,
  });
}

export async function isAlreadyImported(
  userId: string,
  provider: string,
  externalWorkoutId: string,
): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ id: syncImports.id })
    .from(syncImports)
    .where(
      and(
        eq(syncImports.userId, userId),
        eq(syncImports.provider, provider),
        eq(syncImports.externalWorkoutId, externalWorkoutId),
      ),
    );
  return !!row;
}

export async function deleteImportByActivity(activityId: string) {
  const db = getDb();
  await db.delete(syncImports).where(eq(syncImports.activityId, activityId));
}

// Single callsite for "create an activity from an imported workout and record
// the dedup entry". Providers call this instead of calling createActivity +
// recordImport separately, so the pair stays atomic from the provider's view.
export async function importActivity(
  userId: string,
  provider: string,
  externalWorkoutId: string,
  input: {
    name: string;
    gpx?: string;
    // Stats-only imports (no GPS file — e.g. Garmin notifications for
    // FIT-less activities) carry whatever the provider's summary had.
    distance?: number | null;
    duration?: number | null;
    startedAt?: Date | null;
    // Already normalized to our enum by the caller (see mapSportType);
    // undefined when the provider supplied no sport.
    sportType?: SportType;
  },
): Promise<{ activityId: string }> {
  const activityId = await createActivity(userId, {
    name: input.name,
    gpx: input.gpx,
    distance: input.distance,
    duration: input.duration,
    startedAt: input.startedAt,
    sportType: input.sportType,
  });
  await recordImport(userId, provider, externalWorkoutId, activityId);
  return { activityId };
}

export async function getImportedIds(
  userId: string,
  provider: string,
  externalWorkoutIds: string[],
): Promise<Set<string>> {
  if (externalWorkoutIds.length === 0) return new Set();
  const db = getDb();
  const rows = await db
    .select({ externalWorkoutId: syncImports.externalWorkoutId })
    .from(syncImports)
    .where(
      and(
        eq(syncImports.userId, userId),
        eq(syncImports.provider, provider),
        inArray(syncImports.externalWorkoutId, externalWorkoutIds),
      ),
    );
  return new Set(rows.map((r) => r.externalWorkoutId));
}
