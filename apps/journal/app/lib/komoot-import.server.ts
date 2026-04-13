import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "./db.ts";
import { importBatches } from "@trails-cool/db/schema/journal";
import { createActivity } from "./activities.server.ts";
import { createRoute, type RouteInput } from "./routes.server.ts";
import { isAlreadyImported, recordImport } from "./sync/imports.server.ts";
import { fetchTours, fetchTourGpx, type KomootCredentials, type KomootTour } from "./komoot.server.ts";

export async function importKomootTours(
  userId: string,
  connectionId: string,
  creds: KomootCredentials,
  existingBatchId?: string,
): Promise<string> {
  const db = getDb();
  const batchId = existingBatchId ?? randomUUID();

  if (!existingBatchId) {
    await db.insert(importBatches).values({
      id: batchId,
      userId,
      connectionId,
      status: "running",
    });
  } else {
    await db
      .update(importBatches)
      .set({ status: "running" })
      .where(eq(importBatches.id, batchId));
  }

  try {
    let page = 0;
    let totalFound = 0;
    let importedCount = 0;
    let duplicateCount = 0;
    let hasMore = true;

    while (hasMore) {
      const result = await fetchTours(creds, page);
      totalFound += result.tours.length;

      await db
        .update(importBatches)
        .set({ totalFound })
        .where(eq(importBatches.id, batchId));

      for (const tour of result.tours) {
        const alreadyImported = await isAlreadyImported(userId, "komoot", tour.id);
        if (alreadyImported) {
          duplicateCount++;
          continue;
        }

        try {
          await importSingleTour(userId, creds, tour);
          importedCount++;
        } catch (err) {
          console.error(`Failed to import Komoot tour ${tour.id}:`, err);
        }

        await db
          .update(importBatches)
          .set({ importedCount, duplicateCount })
          .where(eq(importBatches.id, batchId));
      }

      hasMore = page + 1 < result.totalPages;
      page++;
    }

    await db
      .update(importBatches)
      .set({
        status: "completed",
        totalFound,
        importedCount,
        duplicateCount,
        completedAt: new Date(),
      })
      .where(eq(importBatches.id, batchId));

    return batchId;
  } catch (err) {
    await db
      .update(importBatches)
      .set({
        status: "failed",
        errorMessage: err instanceof Error ? err.message : String(err),
        completedAt: new Date(),
      })
      .where(eq(importBatches.id, batchId));
    throw err;
  }
}

async function importSingleTour(
  userId: string,
  creds: KomootCredentials,
  tour: KomootTour,
): Promise<void> {
  let gpx: string | undefined;
  try {
    gpx = await fetchTourGpx(creds, tour.id);
  } catch {
    // Tour without downloadable GPX — import metadata only
  }

  const routeInput: RouteInput = {
    name: tour.name,
    gpx,
  };

  const routeId = await createRoute(userId, routeInput);

  // Mark the route source as komoot
  const db = getDb();
  const { routes } = await import("@trails-cool/db/schema/journal");
  await db.update(routes).set({ source: "komoot" }).where(eq(routes.id, routeId));

  const activityId = await createActivity(userId, {
    name: tour.name,
    gpx,
    routeId,
    distance: tour.distance,
    duration: tour.duration,
    startedAt: new Date(tour.date),
  });

  await recordImport(userId, "komoot", tour.id, activityId);
}

export async function getLatestBatch(userId: string, connectionId: string) {
  const db = getDb();
  const [batch] = await db
    .select()
    .from(importBatches)
    .where(eq(importBatches.connectionId, connectionId))
    .orderBy(importBatches.startedAt)
    .limit(1);
  return batch ?? null;
}
