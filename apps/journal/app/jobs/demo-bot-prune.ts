import type { JobDefinition } from "@trails-cool/jobs";
import {
  demoRetentionDays,
  isDemoBotEnabled,
  pruneSynthetic,
  refreshDemoBotGauges,
} from "../lib/demo-bot.server.ts";
import { logger } from "../lib/logger.server.ts";

/**
 * Daily prune. Deletes synthetic rows older than
 * `DEMO_BOT_RETENTION_DAYS` (default 14). Never touches real users.
 */
export const demoBotPruneJob: JobDefinition = {
  name: "demo-bot:prune",
  cron: "15 3 * * *",
  retryLimit: 1,
  expireInSeconds: 60,
  async handler() {
    if (!isDemoBotEnabled()) return { skipped: "disabled" };
    const days = demoRetentionDays();
    const counts = await pruneSynthetic(days);
    logger.info({ days, ...counts }, "demo-bot prune");
    await refreshDemoBotGauges();
    return { days, ...counts };
  },
};
