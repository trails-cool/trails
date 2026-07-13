import { defineJournalJob } from "./payloads.ts";
import { sweepProcessedActivities } from "../lib/federation-replay.server.ts";
import { logger } from "../lib/logger.server.ts";

/**
 * Daily cleanup of federation_processed_activities rows older than 30
 * days (spec: federation-operations "Inbound replay defense"). Replays of
 * activities that old are already rejected by HTTP-signature date
 * freshness, so the dedup record is no longer needed; this keeps the
 * table bounded.
 */
export const federationDedupSweepJob = defineJournalJob({
  name: "federation-dedup-sweep",
  cron: "30 4 * * *", // daily at 04:30 UTC (offset from federation-kv-sweep at 04:15)
  retryLimit: 1,
  expireInSeconds: 60,
  async handler() {
    const purged = await sweepProcessedActivities();
    logger.info({ purged }, "federation-dedup-sweep");
    return { purged };
  },
});
