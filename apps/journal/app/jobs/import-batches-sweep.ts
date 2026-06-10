import { defineJournalJob } from "./payloads.ts";
import { and, lt, inArray, count } from "drizzle-orm";
import { getDb } from "../lib/db.ts";
import { importBatches, type ImportBatchStatus } from "@trails-cool/db/schema/journal";
import { logger } from "../lib/logger.server.ts";

const STALE_MS = 10 * 60 * 1000;
const STALE_STATUSES: ImportBatchStatus[] = ["pending", "running"];

export const importBatchesSweepJob = defineJournalJob({
  name: "import-batches-sweep",
  cron: "* * * * *",
  retryLimit: 0,
  expireInSeconds: 55,
  async handler() {
    const db = getDb();
    const cutoff = new Date(Date.now() - STALE_MS);
    const staleFilter = and(
      inArray(importBatches.status, STALE_STATUSES),
      lt(importBatches.startedAt, cutoff),
    );

    // Skip the write when nothing is stale to avoid an unconditional UPDATE every minute.
    const rows = await db
      .select({ staleCount: count() })
      .from(importBatches)
      .where(staleFilter);
    if ((rows[0]?.staleCount ?? 0) === 0) return;

    const result = await db
      .update(importBatches)
      .set({
        status: "failed" satisfies ImportBatchStatus,
        errorMessage: "Import timed out — the server may have restarted mid-import. Click 'Run again' to retry.",
        completedAt: new Date(),
      })
      .where(staleFilter)
      .returning({ id: importBatches.id });

    logger.info({ count: result.length }, "import-batches-sweep: marked stale batches as failed");
  },
});
