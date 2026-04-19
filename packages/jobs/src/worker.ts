import type { PgBoss } from "pg-boss";
import type { JobDefinition } from "./types.ts";

/**
 * Characters pg-boss v11+ accepts for queue and schedule keys. Stricter
 * than v10, which silently accepted `:` (and therefore let our
 * `demo-bot:generate` etc. names through on older pg-boss). On the
 * upgrade path we renamed them, and this guard keeps us from regressing.
 */
const VALID_NAME = /^[A-Za-z0-9_.-]+$/;

export function assertValidJobName(name: string): void {
  if (!VALID_NAME.test(name)) {
    throw new Error(
      `Invalid pg-boss queue name "${name}": only letters, numbers, hyphens, underscores, and periods are allowed.`,
    );
  }
}

export async function startWorker(
  boss: PgBoss,
  jobs: JobDefinition[],
): Promise<void> {
  // Validate every job name before any side effects so a bad name fails
  // loudly at worker boot instead of silently producing an unreachable
  // queue somewhere downstream.
  for (const job of jobs) assertValidJobName(job.name);

  await boss.start();

  for (const job of jobs) {
    await boss.createQueue(job.name);

    if (job.cron) {
      await boss.schedule(job.name, job.cron, undefined, {
        retryLimit: job.retryLimit,
        expireInSeconds: job.expireInSeconds,
      });
    }

    await boss.work(job.name, job.handler);
  }

  const onShutdown = async () => {
    await boss.stop({ graceful: true, timeout: 10_000 });
    process.exit(0);
  };

  process.on("SIGTERM", onShutdown);
  process.on("SIGINT", onShutdown);
}
