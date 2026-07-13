import { defineJournalJob } from "./payloads.ts";
import { and, eq } from "drizzle-orm";
import { activities, users } from "@trails-cool/db/schema/journal";
import { getDb } from "../lib/db.ts";
import { getOrigin } from "../lib/config.server.ts";
import { getFederation } from "../lib/federation.server.ts";
import {
  activityToCreate,
  activityToDelete,
  type FederatableActivity,
} from "../lib/federation-objects.server.ts";
import {
  getCachedRemoteActor,
  upsertRemoteActor,
  type DeliveryPayload,
} from "../lib/federation-delivery.server.ts";
import { logger } from "../lib/logger.server.ts";
import { federationDeliveryTotal } from "../lib/metrics.server.ts";

/**
 * Outbound pacing (spec 5.5): never exceed 1 request/second per remote
 * host. In-process map is sufficient — pg-boss works this queue
 * sequentially in the single journal process.
 */
const lastSendPerHost = new Map<string, number>();
const MIN_INTERVAL_MS = 1000;

async function paceHost(host: string): Promise<void> {
  const last = lastSendPerHost.get(host) ?? 0;
  const wait = last + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastSendPerHost.set(host, Date.now());
}

/**
 * Deliver one activity to one remote follower's inbox (spec 5.3/5.4).
 * One job per (activity, recipient) so each delivery retries with
 * exponential backoff independently (configured at enqueue time —
 * see enqueueActivityDeliveries). A thrown error marks the attempt
 * failed and pg-boss retries; exhausting the budget is the permanent
 * failure, logged by the final catch.
 */
export const deliverActivityJob = defineJournalJob({
  name: "deliver-activity",
  expireInSeconds: 60,
  async handler(jobs) {
    for (const job of jobs) {
      const p = job.data;
      try {
        const outcome = await deliverOne(p);
        federationDeliveryTotal.inc({ outcome });
      } catch (err) {
        federationDeliveryTotal.inc({ outcome: "failed" });
        logger.warn(
          { err, action: p.action, objectIri: p.objectIri, recipient: p.recipientActorIri },
          "deliver-activity attempt failed (pg-boss will retry until budget exhausted)",
        );
        throw err;
      }
    }
  },
});

async function deliverOne(p: DeliveryPayload): Promise<"delivered" | "skipped"> {
  const federation = getFederation();
  const ctx = federation.createContext(new URL(getOrigin()), undefined);

  // Build the activity to send. For `create`, re-read the row at
  // delivery time: if it was deleted or un-publicized since enqueue,
  // skip rather than leak.
  let activity;
  if (p.action === "create") {
    const db = getDb();
    const [row] = await db
      .select()
      .from(activities)
      .where(and(eq(activities.id, p.activityId!), eq(activities.visibility, "public")))
      .limit(1);
    if (!row) {
      logger.info({ objectIri: p.objectIri }, "deliver-activity: activity gone or non-public; skipping");
      return "skipped";
    }
    // Spec 9.3: flipping the profile to private stops federation — also
    // for deliveries already enqueued when the flip happened.
    const [owner] = await db
      .select({ profileVisibility: users.profileVisibility })
      .from(users)
      .where(eq(users.username, p.ownerUsername))
      .limit(1);
    if (!owner || owner.profileVisibility !== "public") {
      logger.info({ objectIri: p.objectIri }, "deliver-activity: owner no longer public; skipping");
      return "skipped";
    }
    activity = activityToCreate(row as FederatableActivity, p.ownerUsername);
  } else {
    activity = activityToDelete(p.objectIri, p.ownerUsername);
  }

  // Resolve the recipient's inbox: cached remote_actors row first,
  // actor-document fetch as fallback (which also primes the cache).
  const recipientIri = new URL(p.recipientActorIri);
  let inboxUrl: URL;
  const cached = await getCachedRemoteActor(p.recipientActorIri);
  if (cached?.inboxUrl) {
    inboxUrl = new URL(cached.inboxUrl);
  } else {
    await paceHost(recipientIri.host);
    const actor = await ctx.lookupObject(recipientIri);
    const fetchedInbox =
      actor != null && "inboxId" in actor ? (actor.inboxId as URL | null) : null;
    if (!fetchedInbox) {
      throw new Error(`deliver-activity: cannot resolve inbox for ${p.recipientActorIri}`);
    }
    inboxUrl = fetchedInbox;
    await upsertRemoteActor({
      actorIri: p.recipientActorIri,
      inboxUrl: inboxUrl.href,
      domain: recipientIri.host,
    });
  }

  await paceHost(inboxUrl.host);
  await ctx.sendActivity(
    // Identifier and username are the same thing in our actor model.
    { identifier: p.ownerUsername },
    { id: recipientIri, inboxId: inboxUrl },
    activity,
  );
  logger.info(
    { action: p.action, objectIri: p.objectIri, recipient: p.recipientActorIri },
    "deliver-activity: delivered",
  );
  return "delivered";
}
