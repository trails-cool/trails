import type { Job } from "pg-boss";

/**
 * A pg-boss job definition. The payload type is intentionally
 * `unknown` at this boundary: a heterogeneous `JobDefinition[]` array
 * (e.g. the one in `apps/journal/server.ts`) was previously forced to
 * cast each typed job to `any` because of contravariance — a handler
 * taking `Job<SpecificPayload>` is not assignable to one taking
 * `Job<object>`. Handlers narrow internally instead.
 */
export interface JobDefinition {
  name: string;
  handler: (jobs: Job<unknown>[]) => Promise<unknown>;
  cron?: string;
  retryLimit?: number;
  expireInSeconds?: number;
}
