import { defineJournalJob } from "./payloads.ts";
import { logger } from "../lib/logger.server.ts";
import { withFreshCredentials } from "../lib/connected-services/manager.ts";
import {
  markBatchFailed,
  runKomootBulkImport,
  type KomootCreds,
} from "../lib/komoot-bulk-import.server.ts";

export const komootBulkImportJob = defineJournalJob({
  name: "komoot-bulk-import",
  retryLimit: 1,
  expireInSeconds: 1800,
  async handler(jobs) {
    const batch = Array.isArray(jobs) ? jobs : [jobs];
    for (const job of batch) {
      const { batchId, userId, serviceId } = job.data;
      logger.info({ batchId, userId }, "komoot bulk import job started");
      try {
        // Credentials are resolved through the ConnectedServiceManager at
        // execution time — the payload carries only the serviceId, so
        // nothing credential-shaped sits in the job table and a relink
        // between enqueue and execution is picked up here.
        await withFreshCredentials(serviceId, (creds) =>
          runKomootBulkImport(batchId, userId, creds as KomootCreds),
        );
      } catch (err) {
        // runKomootBulkImport marks its own failures; this covers errors
        // before it ran (service missing/not active/needs relink), where
        // the batch would otherwise stay "pending" forever.
        await markBatchFailed(batchId, err instanceof Error ? err.message : String(err));
        throw err;
      }
    }
  },
});
