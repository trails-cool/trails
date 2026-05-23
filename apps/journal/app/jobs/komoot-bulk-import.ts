import type { JobDefinition } from "@trails-cool/jobs";
import { logger } from "../lib/logger.server.ts";
import { runKomootBulkImport } from "../lib/komoot-bulk-import.server.ts";

type KomootCreds =
  | { mode: "public"; komootUserId: string }
  | { mode: "authenticated"; email: string; encryptedPassword: string; komootUserId: string };

interface KomootBulkImportData extends Record<string, unknown> {
  batchId: string;
  userId: string;
  creds: KomootCreds;
}

export const komootBulkImportJob: JobDefinition<KomootBulkImportData> = {
  name: "komoot-bulk-import",
  retryLimit: 1,
  expireInSeconds: 1800,
  async handler(jobs) {
    const batch = Array.isArray(jobs) ? jobs : [jobs];
    for (const job of batch) {
      const { batchId, userId, creds } = job.data;
      logger.info({ batchId, userId }, "komoot bulk import job started");
      await runKomootBulkImport(batchId, userId, creds);
    }
  },
};
