import { defineJob, type JobDefinition, type TypedJobDefinition } from "@trails-cool/jobs";
import type { DeliveryPayload } from "../lib/federation-delivery.server.ts";
import type { GarminImportData } from "../lib/connected-services/providers/garmin/import.server.ts";

/**
 * Every journal job queue and its payload shape, in one place. The
 * typed `enqueue` / `enqueueOptional` in boss.server.ts and the
 * `defineJournalJob` helper below both key off this map, so an enqueue
 * site and its handler cannot drift apart, and a queue-name typo is a
 * compile error instead of an orphaned queue.
 *
 * `void` marks cron-only jobs that are never enqueued with data.
 */
export interface JobPayloads {
  "backfill-user-keypairs": Record<string, never>;
  "consumed-jti-sweep": void;
  "deliver-activity": DeliveryPayload;
  "demo-bot-generate": void;
  "demo-bot-prune": void;
  "federation-kv-sweep": void;
  "garmin-import-activity": GarminImportData;
  "import-batches-sweep": void;
  "komoot-bulk-import": { batchId: string; userId: string; serviceId: string };
  "notifications-fanout": { activityId: string };
  "notifications-purge": void;
  "poll-remote-actor": { actorIri: string };
  "poll-remote-outboxes": void;
  "send-welcome-email": { email: string; username: string };
  "surface-backfill": { kind: "route" | "activity"; id: string };
}

export type JobName = keyof JobPayloads;

/**
 * defineJob, constrained to the journal's queue map: the name must be
 * a known queue and the handler's payload type follows from it.
 */
export function defineJournalJob<K extends JobName>(
  definition: TypedJobDefinition<JobPayloads[K]> & { name: K },
): JobDefinition {
  return defineJob<JobPayloads[K]>(definition);
}
