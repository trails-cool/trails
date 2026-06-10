import { defineJournalJob } from "./payloads.ts";
import { ensureUserKeypair, listUsersWithoutKeypair } from "../lib/federation-keys.server.ts";
import { logger } from "../lib/logger.server.ts";

/**
 * One-shot backfill: generate a federation keypair for every user who
 * predates federation (spec: "Existing-user backfill at deploy"). The
 * server enqueues this once at startup whenever FEDERATION_ENABLED is
 * on (singleton-keyed, so repeat startups don't stack runs); each run
 * only touches users whose public_key IS NULL, so re-runs are no-ops.
 * New users get keys at registration and never appear in this workload.
 */
export const backfillUserKeypairsJob = defineJournalJob({
  name: "backfill-user-keypairs",
  retryLimit: 3,
  expireInSeconds: 300,
  async handler() {
    const ids = await listUsersWithoutKeypair();
    let generated = 0;
    for (const id of ids) {
      if (await ensureUserKeypair(id)) generated++;
    }
    logger.info({ candidates: ids.length, generated }, "backfill-user-keypairs");
    return { candidates: ids.length, generated };
  },
});
