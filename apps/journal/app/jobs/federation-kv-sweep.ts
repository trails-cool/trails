import { defineJournalJob } from "./payloads.ts";
import { PostgresKvStore } from "../lib/federation-kv.server.ts";
import { logger } from "../lib/logger.server.ts";

/**
 * Daily cleanup of expired federation_kv rows (Fedify replay-protection
 * nonces and caches carry TTLs; reads already filter expired rows, this
 * keeps the table from growing unbounded).
 */
export const federationKvSweepJob = defineJournalJob({
  name: "federation-kv-sweep",
  cron: "15 4 * * *", // daily at 04:15 UTC (offset from the other sweeps)
  retryLimit: 1,
  expireInSeconds: 60,
  async handler() {
    const purged = await new PostgresKvStore().sweepExpired();
    logger.info({ purged }, "federation-kv-sweep");
    return { purged };
  },
});
