import type { JobDefinition } from "@trails-cool/jobs";
import { eq, and } from "drizzle-orm";
import { getDb } from "../lib/db.ts";
import { syncConnections } from "@trails-cool/db/schema/journal";
import { decrypt } from "../lib/crypto.server.ts";
import { importKomootTours } from "../lib/komoot-import.server.ts";
import type { KomootCredentials } from "../lib/komoot.server.ts";
import { logger } from "../lib/logger.server.ts";

interface KomootImportData {
  userId: string;
  connectionId: string;
  batchId: string;
}

export const komootImportJob: JobDefinition<KomootImportData> = {
  name: "komoot-import",
  retryLimit: 1,
  expireInSeconds: 300,
  async handler(jobs) {
    for (const job of jobs) {
      const { userId, connectionId, batchId } = job.data;
      logger.info({ userId, connectionId, batchId }, "starting Komoot import job");

      const db = getDb();
      const [connection] = await db
        .select()
        .from(syncConnections)
        .where(
          and(
            eq(syncConnections.id, connectionId),
            eq(syncConnections.userId, userId),
          ),
        );

      if (!connection?.encryptedCredentials) {
        throw new Error(`Komoot connection ${connectionId} not found or missing credentials`);
      }

      const { email, password } = JSON.parse(decrypt(connection.encryptedCredentials)) as {
        email: string;
        password: string;
      };
      const creds: KomootCredentials = {
        email,
        password,
        username: connection.providerUserId!,
        token: connection.accessToken,
      };

      await importKomootTours(userId, connectionId, creds, batchId);
      logger.info({ batchId }, "Komoot import job completed");
    }
  },
};
