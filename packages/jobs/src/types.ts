import type { Job } from "pg-boss";

export interface JobDefinition<T extends object = object> {
  name: string;
  handler: (jobs: Job<T>[]) => Promise<unknown>;
  cron?: string;
  retryLimit?: number;
  expireInSeconds?: number;
}
