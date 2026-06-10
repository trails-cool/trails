import { defineJournalJob } from "./payloads.ts";
import { lt } from "drizzle-orm";
import { consumedJwtJti } from "@trails-cool/db/schema/journal";
import { getDb } from "../lib/db.ts";
import { logger } from "../lib/logger.server.ts";

/**
 * Daily cleanup for the JWT replay-protection table. Each row was
 * inserted by `verifyRouteToken` to mark a token as consumed; once
 * the token's `exp` claim has passed, the row is no longer useful
 * (the JWT itself would fail signature verification before reaching
 * the consume step). Bound the table to keep it tiny.
 *
 * See planner-audit #2 Phase B.
 */
export const consumedJtiSweepJob = defineJournalJob({
  name: "consumed-jti-sweep",
  cron: "45 3 * * *", // daily at 03:45 UTC (offset from notifications-purge)
  retryLimit: 1,
  expireInSeconds: 60,
  async handler() {
    const db = getDb();
    const result = await db
      .delete(consumedJwtJti)
      .where(lt(consumedJwtJti.expiresAt, new Date()))
      .returning({ jti: consumedJwtJti.jti });
    const purged = result.length;
    logger.info({ purged }, "consumed-jti-sweep");
    return { purged };
  },
});
