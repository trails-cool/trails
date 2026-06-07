import type { JobDefinition } from "@trails-cool/jobs";
import { logger } from "../lib/logger.server.ts";
import {
  runGarminActivityImport,
  type GarminImportData,
} from "../lib/connected-services/providers/garmin/import.server.ts";

// Garmin webhook notifications enqueue here (spec: garmin-import,
// "Push-notification activity import"): the webhook answers 200
// immediately and this job does the slow part — authorized file
// download, FIT→GPX, activity creation. Backfill bursts deliver many
// notifications at once; the queue absorbs them and pg-boss retries
// transient download failures.
export const garminImportActivityJob: JobDefinition = {
  name: "garmin-import-activity",
  retryLimit: 3,
  expireInSeconds: 300,
  async handler(jobs) {
    const batch = Array.isArray(jobs) ? jobs : [jobs];
    for (const job of batch) {
      const data = job.data as GarminImportData;
      try {
        await runGarminActivityImport(data);
      } catch (err) {
        logger.warn(
          { err, externalId: data.externalId },
          "garmin-import-activity failed (pg-boss will retry)",
        );
        throw err;
      }
    }
  },
};
