import type { JobDefinition } from "@trails-cool/jobs";
import { and, lt, inArray } from "drizzle-orm";
import { getDb } from "../lib/db.ts";
import { importBatches } from "@trails-cool/db/schema/journal";
import { logger } from "../lib/logger.server.ts";

// Batches stuck longer than this without completing are considered stale.
const STALE_MS = 10 * 60 * 1000;

export const importBatchesSweepJob: JobDefinition = {
  name: "import-batches-sweep",
  cron: "* * * * *",
  retryLimit: 0,
  expireInSeconds: 55,
  async handler() {
    const db = getDb();
    const cutoff = new Date(Date.now() - STALE_MS);

    const result = await db
      .update(importBatches)
      .set({
        status: "failed",
        errorMessage: "Import timed out — the server may have restarted mid-import. Click 'Run again' to retry.",
        completedAt: new Date(),
      })
      .where(
        and(
          inArray(importBatches.status, ["pending", "running"]),
          lt(importBatches.startedAt, cutoff),
        ),
      )
      .returning({ id: importBatches.id });

    if (result.length > 0) {
      logger.info({ count: result.length }, "import-batches-sweep: marked stale batches as failed");
    }
  },
};
