import { defineJournalJob } from "./payloads.ts";
import { pollRemoteActor } from "../lib/federation-ingest.server.ts";
import { logger } from "../lib/logger.server.ts";

/**
 * Poll one remote trails actor's outbox (spec §7). Enqueued by the
 * inbox Accept(Follow) listener (first poll, 7.5) and fanned out by
 * the poll-remote-outboxes cron sweep (7.1).
 */
export const pollRemoteActorJob = defineJournalJob({
  name: "poll-remote-actor",
  retryLimit: 2,
  expireInSeconds: 120,
  async handler(jobs) {
    for (const job of jobs) {
      // Defensive: jobs enqueued before the typed seam may carry no data.
      const actorIri = job.data?.actorIri;
      if (!actorIri) continue;
      const result = await pollRemoteActor(actorIri);
      logger.info({ actorIri, result }, "poll-remote-actor");
    }
  },
});
