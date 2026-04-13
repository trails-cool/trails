import type PgBoss from "pg-boss";

export interface JobDefinition<T = unknown> {
  name: string;
  handler: (jobs: PgBoss.Job<T>[]) => Promise<unknown>;
  cron?: string;
  retryLimit?: number;
  expireInSeconds?: number;
}
