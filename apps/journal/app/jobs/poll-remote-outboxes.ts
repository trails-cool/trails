import { defineJournalJob } from "./payloads.ts";
import { listActorsDuePolling } from "../lib/federation-ingest.server.ts";
import { enqueueOptional } from "../lib/boss.server.ts";
import { logger } from "../lib/logger.server.ts";

/**
 * Cron sweep (spec 7.1): every 5 minutes, find remote trails actors
 * that at least one local user follows (accepted) and that haven't
 * been polled within the last hour, and fan out one poll-remote-actor
 * job each. Per-host pacing lives in the poll itself.
 */
export const pollRemoteOutboxesJob = defineJournalJob({
  name: "poll-remote-outboxes",
  cron: "*/5 * * * *",
  retryLimit: 1,
  expireInSeconds: 60,
  async handler() {
    const due = await listActorsDuePolling();
    for (const actorIri of due) {
      await enqueueOptional("poll-remote-actor", { actorIri }, { source: "poll-remote-outboxes" });
    }
    if (due.length > 0) logger.info({ due: due.length }, "poll-remote-outboxes sweep");
    return { due: due.length };
  },
});
