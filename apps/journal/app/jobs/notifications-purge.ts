import type { JobDefinition } from "@trails-cool/jobs";
import { purgeReadOlderThan } from "../lib/notifications.server.ts";
import { logger } from "../lib/logger.server.ts";

/**
 * Daily retention pass. Drops notifications whose `read_at` is older
 * than 90 days; unread rows are kept indefinitely so users never miss
 * an event.
 */
export const notificationsPurgeJob: JobDefinition = {
  name: "notifications-purge",
  cron: "30 3 * * *", // daily at 03:30 UTC (offset from demo-bot-prune to spread load)
  retryLimit: 1,
  expireInSeconds: 60,
  async handler() {
    const days = 90;
    const purged = await purgeReadOlderThan(days);
    logger.info({ days, purged }, "notifications-purge");
    return { days, purged };
  },
};
