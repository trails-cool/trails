import { and, eq, notInArray } from "drizzle-orm";
import { getDb } from "./db.ts";
import { importBatches } from "@trails-cool/db/schema/journal";
import { fetchKomootTours, fetchKomootTourGpx } from "./komoot.server.ts";
import { isAlreadyImported, recordImport } from "./sync/imports.server.ts";
import { createActivity } from "./activities.server.ts";
import { mapSportType } from "./sport-type.ts";
import { decrypt } from "./crypto.server.ts";
import { logger } from "./logger.server.ts";

export type KomootCreds =
  | { mode: "public"; komootUserId: string }
  | { mode: "authenticated"; email: string; encryptedPassword: string; komootUserId: string };

/**
 * Marks a batch failed unless it already reached a terminal state.
 * Used by the job handler when credential resolution fails before
 * runKomootBulkImport (which owns failure-marking for its own errors)
 * ever runs — otherwise the batch would sit "pending" forever.
 */
export async function markBatchFailed(batchId: string, message: string): Promise<void> {
  const db = getDb();
  await db
    .update(importBatches)
    .set({ status: "failed", errorMessage: message, completedAt: new Date() })
    .where(
      and(
        eq(importBatches.id, batchId),
        notInArray(importBatches.status, ["completed", "failed"]),
      ),
    );
}

function getBasicAuthToken(creds: KomootCreds): string | undefined {
  if (creds.mode !== "authenticated") return undefined;
  const password = decrypt(creds.encryptedPassword);
  return Buffer.from(`${creds.email}:${password}`).toString("base64");
}

export async function runKomootBulkImport(
  batchId: string,
  userId: string,
  creds: KomootCreds,
): Promise<void> {
  const db = getDb();
  const basicAuthToken = getBasicAuthToken(creds);
  const komootUserId = creds.komootUserId;

  await db
    .update(importBatches)
    .set({ status: "running" })
    .where(eq(importBatches.id, batchId));

  try {
    let page = 1;
    let hasMore = true;
    let totalFound = 0;
    let importedCount = 0;
    let duplicateCount = 0;

    while (hasMore) {
      let result: Awaited<ReturnType<typeof fetchKomootTours>>;
      try {
        result = await fetchKomootTours(komootUserId, page, basicAuthToken);
      } catch (err) {
        logger.warn({ batchId, page, err }, "komoot bulk import: fetchKomootTours failed, stopping");
        break;
      }

      totalFound += result.tours.length;
      hasMore = page < result.totalPages;
      page++;

      await db
        .update(importBatches)
        .set({ totalFound })
        .where(eq(importBatches.id, batchId));

      for (const tour of result.tours) {
        if (await isAlreadyImported(userId, "komoot", tour.id)) {
          duplicateCount++;
          await db
            .update(importBatches)
            .set({ duplicateCount })
            .where(eq(importBatches.id, batchId));
          continue;
        }

        let gpx: string | undefined;
        try {
          gpx = await fetchKomootTourGpx(tour.id, basicAuthToken);
        } catch {
          // No GPX — import metadata only
        }

        try {
          const activityId = await createActivity(userId, {
            name: tour.name,
            gpx,
            sportType: mapSportType(tour.sport),
            distance: tour.distance > 0 ? tour.distance : null,
            duration: tour.duration > 0 ? tour.duration : null,
            startedAt: tour.date ? new Date(tour.date) : null,
          });
          await recordImport(userId, "komoot", tour.id, activityId);
          importedCount++;
        } catch (err) {
          logger.warn({ batchId, tourId: tour.id, err }, "komoot bulk import: failed to import tour");
        }

        await db
          .update(importBatches)
          .set({ importedCount, duplicateCount })
          .where(eq(importBatches.id, batchId));
      }
    }

    await db
      .update(importBatches)
      .set({ status: "completed", totalFound, importedCount, duplicateCount, completedAt: new Date() })
      .where(eq(importBatches.id, batchId));

    logger.info({ batchId, totalFound, importedCount, duplicateCount }, "komoot bulk import completed");
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
