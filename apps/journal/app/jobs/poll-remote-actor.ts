import type { JobDefinition } from "@trails-cool/jobs";
import { pollRemoteActor } from "../lib/federation-ingest.server.ts";
import { logger } from "../lib/logger.server.ts";

interface PollPayload {
  actorIri?: string;
}

/**
 * Poll one remote trails actor's outbox (spec §7). Enqueued by the
 * inbox Accept(Follow) listener (first poll, 7.5) and fanned out by
 * the poll-remote-outboxes cron sweep (7.1).
 */
export const pollRemoteActorJob: JobDefinition = {
  name: "poll-remote-actor",
  retryLimit: 2,
  expireInSeconds: 120,
  async handler(jobs) {
    for (const job of jobs) {
      const { actorIri } = (job.data ?? {}) as PollPayload;
      if (!actorIri) continue;
      const result = await pollRemoteActor(actorIri);
      logger.info({ actorIri, result }, "poll-remote-actor");
    }
  },
};
