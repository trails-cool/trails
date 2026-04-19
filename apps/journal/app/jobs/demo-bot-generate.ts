import type { JobDefinition } from "@trails-cool/jobs";
import {
  DEMO_BACKFILL_TARGET,
  DEMO_DAILY_CAP,
  countSyntheticRoutesRecent,
  countSyntheticRoutesTotal,
  ensureDemoUser,
  generateOneWalk,
  isDemoBotEnabled,
  refreshDemoBotGauges,
  shouldWalkNow,
} from "../lib/demo-bot.server.ts";
import { logger } from "../lib/logger.server.ts";

/**
 * Generate job. Fires every 30 minutes via pg-boss cron. Handler steps:
 *
 * 1. Bail if `DEMO_BOT_ENABLED` is not "true".
 * 2. On first run (no synthetic rows yet) produce a small backfill so the
 *    demo user's profile has content immediately.
 * 3. Otherwise apply the decide-to-walk gate (local hour + p=0.09) and
 *    daily cap; on pass, insert one route+activity via `generateOneWalk`.
 */
export const demoBotGenerateJob: JobDefinition = {
  name: "demo-bot-generate",
  cron: "0,30 * * * *",
  retryLimit: 1,
  expireInSeconds: 120,
  async handler() {
    if (!isDemoBotEnabled()) return { skipped: "disabled" };

    const ownerId = await ensureDemoUser();

    const total = await countSyntheticRoutesTotal();
    if (total === 0) {
      let inserted = 0;
      for (let i = 0; i < DEMO_BACKFILL_TARGET; i++) {
        const id = await generateOneWalk(ownerId);
        if (id) inserted++;
      }
      logger.info({ inserted }, "demo-bot backfill complete");
      await refreshDemoBotGauges();
      return { mode: "backfill", inserted };
    }

    const recent = await countSyntheticRoutesRecent(14);
    if (recent >= DEMO_DAILY_CAP) {
      logger.info({ recent, cap: DEMO_DAILY_CAP }, "demo-bot cap hit, skipping");
      return { skipped: "cap", recent };
    }

    const now = new Date();
    if (!shouldWalkNow(now)) return { skipped: "gate" };

    const id = await generateOneWalk(ownerId, { now });
    logger.info({ inserted: id ? 1 : 0, routeId: id }, "demo-bot walk");
    await refreshDemoBotGauges();
    return { mode: "single", routeId: id };
  },
};
