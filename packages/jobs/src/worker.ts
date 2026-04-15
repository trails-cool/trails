import type PgBoss from "pg-boss";
import type { JobDefinition } from "./types.ts";

export async function startWorker(
  boss: PgBoss,
  jobs: JobDefinition<any>[],
): Promise<void> {
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
