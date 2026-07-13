// Push delivery of local public activities to accepted remote
// followers (spec: social-federation, "Push delivery on local activity
// create"). Enqueue side lives here; the actual signed POST happens in
// jobs/deliver-activity.ts.

import { and, eq, isNotNull } from "drizzle-orm";
import { follows, remoteActors, users } from "@trails-cool/db/schema/journal";
import { getDb } from "./db.ts";
import { federationEnabled } from "./federation.server.ts";
import { enqueueOptional } from "./boss.server.ts";
import { activityObjectIri } from "./federation-objects.server.ts";
import { filterBlockedDomains, hostOfIri } from "./federation-blocklist.server.ts";

export type DeliveryAction = "create" | "delete";

/**
 * Which federation action (if any) a visibility change warrants.
 *
 * The asymmetry matters: Mastodon records a `Delete` as a permanent
 * tombstone — a later `Create` for the same URI is silently refused
 * forever. So a retraction must only go out when remotes could
 * actually have the object (it was public), never "just in case"
 * (learned on the 2026-06-07 staging soak, where an unlisted
 * activity's no-op save tombstoned its URI before its first real
 * publish).
 *
 * - → public: push Create. Also for public→public — re-pushing is
 *   harmless (remotes dedupe by id) and doubles as back-delivery.
 * - public → non-public: push Delete(Tombstone) — remotes saw it.
 * - non-public → non-public: nothing — remotes never had it, and a
 *   Delete would poison the URI for any future publish.
 */
export function visibilityTransitionAction(
  previous: string,
  next: string,
): DeliveryAction | null {
  if (next === "public") return "create";
  if (previous === "public") return "delete";
  return null;
}

export interface DeliveryPayload {
  action: DeliveryAction;
  /** Present for `create` — the job re-reads the row at delivery time. */
  activityId?: string;
  /** Object IRI; for `delete` this is all that's left of the activity. */
  objectIri: string;
  ownerUsername: string;
  recipientActorIri: string;
}

/** Accepted remote followers of a local user (the delivery audience). */
export async function listAcceptedRemoteFollowers(ownerId: string): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ actorIri: follows.followerActorIri })
    .from(follows)
    .where(
      and(
        eq(follows.followedUserId, ownerId),
        isNotNull(follows.followerActorIri),
        isNotNull(follows.acceptedAt),
      ),
    );
  return rows.map((r) => r.actorIri).filter((iri): iri is string => iri !== null);
}

/**
 * Fan out one delivery job per accepted remote follower (spec 5.3: a
 * job per follower, each with its own retry/backoff lifecycle). No-op
 * when federation is off or the user has no remote followers — the
 * common case stays a single SELECT.
 */
export async function enqueueActivityDeliveries(
  ownerId: string,
  activityId: string,
  action: DeliveryAction,
): Promise<void> {
  if (!federationEnabled()) return;
  const allRecipients = await listAcceptedRemoteFollowers(ownerId);
  if (allRecipients.length === 0) return;

  // Blocklist boundary: never enqueue a delivery to a blocked instance
  // (spec: federation-operations "Instance blocklist"). Resolve the
  // blocked set once, then drop recipients whose host is on it.
  const blocked = await filterBlockedDomains(
    allRecipients.map(hostOfIri).filter((h): h is string => h !== null),
  );
  const recipients = allRecipients.filter((iri) => {
    const host = hostOfIri(iri);
    return host !== null && !blocked.has(host);
  });
  if (recipients.length === 0) return;

  const db = getDb();
  const [owner] = await db
    .select({ username: users.username, profileVisibility: users.profileVisibility })
    .from(users)
    .where(eq(users.id, ownerId))
    .limit(1);
  // Private profiles don't federate — suppress push delivery entirely
  // (spec 9.3: flipping to private stops federation).
  if (!owner || owner.profileVisibility !== "public") return;

  for (const recipientActorIri of recipients) {
    const payload: DeliveryPayload = {
      action,
      activityId: action === "create" ? activityId : undefined,
      objectIri: activityObjectIri(activityId),
      ownerUsername: owner.username,
      recipientActorIri,
    };
    await enqueueOptional(
      "deliver-activity",
      payload,
      { source: "enqueueActivityDeliveries", action },
      // Spec 5.4: exponential backoff on failure, bounded retry budget.
      // 8 retries with backoff spans roughly a day before permanent fail.
      { retryLimit: 8, retryBackoff: true },
    );
  }
}

export interface CachedRemoteActor {
  actorIri: string;
  inboxUrl: string | null;
}

/** Read the remote actor cache; null when we've never seen the actor. */
export async function getCachedRemoteActor(actorIri: string): Promise<CachedRemoteActor | null> {
  const db = getDb();
  const [row] = await db
    .select({ actorIri: remoteActors.actorIri, inboxUrl: remoteActors.inboxUrl })
    .from(remoteActors)
    .where(eq(remoteActors.actorIri, actorIri))
    .limit(1);
  return row ?? null;
}

/** Upsert the fields delivery/polling learn about a remote actor. */
export async function upsertRemoteActor(fields: {
  actorIri: string;
  inboxUrl?: string | null;
  outboxUrl?: string | null;
  displayName?: string | null;
  username?: string | null;
  domain?: string | null;
}): Promise<void> {
  const db = getDb();
  const { actorIri, ...rest } = fields;
  await db
    .insert(remoteActors)
    .values({ actorIri, ...rest })
    .onConflictDoUpdate({ target: remoteActors.actorIri, set: rest });
}
