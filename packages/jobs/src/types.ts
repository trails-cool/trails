import type { Job } from "pg-boss";

/**
 * A pg-boss job definition. The payload type is `unknown` at this
 * boundary: a heterogeneous `JobDefinition[]` array (e.g. the one in
 * `apps/journal/server.ts`) would otherwise be impossible because of
 * contravariance — a handler taking `Job<SpecificPayload>` is not
 * assignable to one taking `Job<object>`.
 *
 * Don't write handlers against this type directly; author them with
 * `defineJob`, which keeps the payload typed inside the handler and
 * performs the contravariance cast once, here in the package.
 */
export interface JobDefinition {
  name: string;
  handler: (jobs: Job<unknown>[]) => Promise<unknown>;
  cron?: string;
  retryLimit?: number;
  expireInSeconds?: number;
}

/** A JobDefinition whose handler sees the payload type it was enqueued with. */
export interface TypedJobDefinition<TPayload> {
  name: string;
  handler: (jobs: Job<TPayload>[]) => Promise<unknown>;
  cron?: string;
  retryLimit?: number;
  expireInSeconds?: number;
}

/**
 * Author a job with a typed payload. The handler receives
 * `Job<TPayload>[]` — no `job.data as ...` casts at the call sites.
 * This is the single place the contravariance cast happens.
 */
export function defineJob<TPayload = void>(
  definition: TypedJobDefinition<TPayload>,
): JobDefinition {
  return definition as unknown as JobDefinition;
}
