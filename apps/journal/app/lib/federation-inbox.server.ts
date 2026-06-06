// Domain logic behind the federation inbox (spec: social-federation,
// "Narrow inbox — follow-graph activities only"). Pure DB operations,
// kept separate from the Fedify listener wiring in federation.server.ts
// so they're directly unit/integration-testable without HTTP signatures.

import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { users, follows } from "@trails-cool/db/schema/journal";
import { getDb } from "./db.ts";
import { localActorIri } from "./actor-iri.ts";
import { logger } from "./logger.server.ts";

/**
 * Inbound `Follow` from a remote actor targeting a local user.
 * Auto-accepts for public profiles (records the follow row); private
 * profiles refuse without leaking existence — the caller maps `refused`
 * to the same 404 the actor endpoint serves.
 *
 * Idempotent: a duplicate Follow from the same actor upserts onto the
 * `(follower_actor_iri, followed_user_id)` partial unique index, so
 * replays and Mastodon's retry storms cannot double-insert.
 */
export async function recordRemoteFollow(
  remoteActorIri: string,
  localUsername: string,
): Promise<{ outcome: "accepted" | "refused" }> {
  const db = getDb();
  const [user] = await db
    .select({ id: users.id, profileVisibility: users.profileVisibility })
    .from(users)
    .where(eq(users.username, localUsername))
    .limit(1);
  if (!user || user.profileVisibility !== "public") {
    return { outcome: "refused" };
  }
  await db
    .insert(follows)
    .values({
      id: randomUUID(),
      followerActorIri: remoteActorIri,
      followedActorIri: localActorIri(localUsername),
      followedUserId: user.id,
      // Auto-accept: public profiles accept every follow (locked
      // accounts are a later change).
      acceptedAt: new Date(),
    })
    .onConflictDoNothing();
  logger.info({ remoteActorIri, localUsername }, "federation: inbound follow accepted");
  return { outcome: "accepted" };
}

/** Inbound `Undo(Follow)`: remove the remote actor's follow row. */
export async function removeRemoteFollow(
  remoteActorIri: string,
  localUsername: string,
): Promise<void> {
  const db = getDb();
  const deleted = await db
    .delete(follows)
    .where(
      and(
        eq(follows.followerActorIri, remoteActorIri),
        eq(follows.followedActorIri, localActorIri(localUsername)),
      ),
    )
    .returning({ id: follows.id });
  if (deleted.length > 0) {
    logger.info({ remoteActorIri, localUsername }, "federation: inbound follow undone");
  }
}

/**
 * Inbound `Accept(Follow)`: a remote instance accepted our local user's
 * outgoing follow — settle the Pending row. Returns the settled row's
 * remote actor IRI so the caller can enqueue the first outbox poll
 * (spec: "First poll triggered immediately on accepted follow").
 */
export async function settleOutgoingFollow(
  localUserId: string,
  remoteActorIri: string,
): Promise<{ settled: boolean }> {
  const db = getDb();
  const updated = await db
    .update(follows)
    .set({ acceptedAt: new Date() })
    .where(
      and(
        eq(follows.followerId, localUserId),
        eq(follows.followedActorIri, remoteActorIri),
        isNull(follows.acceptedAt),
      ),
    )
    .returning({ id: follows.id });
  if (updated.length > 0) {
    logger.info({ localUserId, remoteActorIri }, "federation: outgoing follow accepted");
  }
  return { settled: updated.length > 0 };
}

/** Inbound `Reject(Follow)`: the remote refused — drop our Pending row. */
export async function rejectOutgoingFollow(
  localUserId: string,
  remoteActorIri: string,
): Promise<void> {
  const db = getDb();
  const deleted = await db
    .delete(follows)
    .where(
      and(
        eq(follows.followerId, localUserId),
        eq(follows.followedActorIri, remoteActorIri),
        isNull(follows.acceptedAt),
      ),
    )
    .returning({ id: follows.id });
  if (deleted.length > 0) {
    logger.info({ localUserId, remoteActorIri }, "federation: outgoing follow rejected by remote");
  }
}
