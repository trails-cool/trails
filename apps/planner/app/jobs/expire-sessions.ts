import type { JobDefinition } from "@trails-cool/jobs";
import { expireSessions } from "../lib/sessions.ts";
import { logger } from "../lib/logger.server.ts";

export const expireSessionsJob: JobDefinition = {
  name: "expire-sessions",
  cron: "0 * * * *",
  retryLimit: 2,
  expireInSeconds: 60,
  async handler() {
    const count = await expireSessions(7);
    logger.info({ count }, "expired stale planner sessions");
    return { expiredCount: count };
  },
};
