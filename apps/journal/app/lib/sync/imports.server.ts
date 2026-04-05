import { randomUUID } from "node:crypto";
import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "../db.ts";
import { syncImports } from "@trails-cool/db/schema/journal";

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
