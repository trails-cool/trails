import { randomUUID } from "node:crypto";
import { eq, and, count, desc, isNull, isNotNull } from "drizzle-orm";
import { getDb } from "./db.ts";
import { users, follows } from "@trails-cool/db/schema/journal";
import { localActorIri } from "./actor-iri.ts";
import { createNotification } from "./notifications.server.ts";
import { logger } from "./logger.server.ts";

export class FollowError extends Error {
  readonly code: "self_follow" | "user_not_found" | "not_found" | "forbidden";
  constructor(code: FollowError["code"], message: string) {
    super(message);
    this.name = "FollowError";
    this.code = code;
  }
}

export interface FollowState {
  following: boolean;
  pending: boolean;
}

async function loadFollowableTarget(targetUsername: string) {
  const db = getDb();
  const [target] = await db
    .select({
      id: users.id,
      username: users.username,
      profileVisibility: users.profileVisibility,
    })
    .from(users)
    .where(eq(users.username, targetUsername));
  if (!target) throw new FollowError("user_not_found", "User not found");
  return target;
}

/**
 * Create a follow row from `followerId` to the local user with username
 * `targetUsername`. Public targets auto-accept (`accepted_at = now()`),
 * private (locked) targets land Pending (`accepted_at = NULL`) and
 * appear in the target's /follows/requests list for manual approval.
 * Idempotent: re-following keeps the existing row's state.
 */
export async function followUser(followerId: string, targetUsername: string): Promise<FollowState> {
  const target = await loadFollowableTarget(targetUsername);
  if (target.id === followerId) {
    throw new FollowError("self_follow", "Users cannot follow themselves");
  }

  const db = getDb();
  const followedActorIri = localActorIri(target.username);
  const [existing] = await db
    .select({ id: follows.id, acceptedAt: follows.acceptedAt })
    .from(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followedActorIri, followedActorIri)));
  if (existing) {
    // Idempotent re-follow: do NOT emit a notification (the recipient
    // was notified when the row was first created).
    return { following: existing.acceptedAt !== null, pending: existing.acceptedAt === null };
  }

  const acceptedAt = target.profileVisibility === "public" ? new Date() : null;
  const followId = randomUUID();
  await db.insert(follows).values({
    id: followId,
    followerId,
    followedActorIri,
    followedUserId: target.id,
    acceptedAt,
  });

  // Notify the target. follow_received for auto-accepted public follows;
  // follow_request_received for Pending follows against private profiles.
  // Errors are logged but don't fail the follow — the user-visible
  // follow already succeeded.
  try {
    const [follower] = await db
      .select({ username: users.username, displayName: users.displayName })
      .from(users)
      .where(eq(users.id, followerId));
    if (follower) {
      const payload = {
        followerUsername: follower.username,
        followerDisplayName: follower.displayName,
      };
      await createNotification(
        acceptedAt !== null
          ? {
              type: "follow_received",
              recipientUserId: target.id,
              actorUserId: followerId,
              subjectId: followId,
              payload,
            }
          : {
              type: "follow_request_received",
              recipientUserId: target.id,
              actorUserId: followerId,
              subjectId: followId,
              payload,
            },
      );
    }
  } catch (err) {
    logger.warn({ err, followId }, "followUser: notification emit failed");
  }

  return {
    following: acceptedAt !== null,
    pending: acceptedAt === null,
  };
}

/**
 * Delete the follow row from `followerId` against the local user with
 * username `targetUsername`. Idempotent.
 */
export async function unfollowUser(followerId: string, targetUsername: string): Promise<FollowState> {
  const target = await loadFollowableTarget(targetUsername);
  const db = getDb();
  const followedActorIri = localActorIri(target.username);
  await db
    .delete(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followedActorIri, followedActorIri)));
  return { following: false, pending: false };
}

/**
 * Read-side helper: is `followerId` currently following `targetUsername`?
 * Returns `null` when no row exists (so callers can distinguish "no follow"
 * from "row exists but unaccepted" once federation's Pending state lands).
 */
export async function getFollowState(
  followerId: string,
  targetUsername: string,
): Promise<FollowState | null> {
  const db = getDb();
  const followedActorIri = localActorIri(targetUsername);
  const [row] = await db
    .select({ acceptedAt: follows.acceptedAt })
    .from(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followedActorIri, followedActorIri)));
  if (!row) return null;
  return { following: row.acceptedAt !== null, pending: row.acceptedAt === null };
}

// Counts include only accepted relations — Pending requests don't count
// toward the public follower/following tallies (a request not yet
// approved isn't a real follow).

export async function countFollowers(userId: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ n: count() })
    .from(follows)
    .where(and(eq(follows.followedUserId, userId), isNotNull(follows.acceptedAt)));
  return row?.n ?? 0;
}

export async function countFollowing(userId: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ n: count() })
    .from(follows)
    .where(and(eq(follows.followerId, userId), isNotNull(follows.acceptedAt)));
  return row?.n ?? 0;
}

/**
 * Count of incoming Pending follow requests for `userId`. Drives the
 * navbar badge. Distinct from countFollowers (which is accepted-only).
 */
export async function countPendingFollowRequests(userId: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ n: count() })
    .from(follows)
    .where(and(eq(follows.followedUserId, userId), isNull(follows.acceptedAt)));
  return row?.n ?? 0;
}

export interface FollowRequest {
  id: string;
  followerUsername: string;
  followerDisplayName: string | null;
  followerDomain: string;
  createdAt: Date;
}

/**
 * Pending incoming follow requests for `userId`. Used by /follows/requests.
 * Reverse-chronological by request creation time.
 */
export async function listPendingFollowRequests(userId: string): Promise<FollowRequest[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: follows.id,
      followerUsername: users.username,
      followerDisplayName: users.displayName,
      followerDomain: users.domain,
      createdAt: follows.createdAt,
    })
    .from(follows)
    .innerJoin(users, eq(follows.followerId, users.id))
    .where(and(eq(follows.followedUserId, userId), isNull(follows.acceptedAt)))
    .orderBy(desc(follows.createdAt));
  return rows;
}

/**
 * Approve a Pending follow request. Owner-bound: `ownerId` must equal
 * `follows.followedUserId` for the row, otherwise the call is a no-op.
 */
export async function approveFollowRequest(ownerId: string, followId: string): Promise<boolean> {
  const db = getDb();
  const result = await db
    .update(follows)
    .set({ acceptedAt: new Date() })
    .where(
      and(
        eq(follows.id, followId),
        eq(follows.followedUserId, ownerId),
        isNull(follows.acceptedAt),
      ),
    )
    .returning({ id: follows.id, followerId: follows.followerId });

  if (result.length === 0) return false;

  // Notify the requester that their request landed. Lookup target's
  // display info for the payload. Errors logged but don't undo the
  // approve — the follow row is already accepted.
  try {
    const followerId = result[0]!.followerId;
    const [target] = await db
      .select({ username: users.username, displayName: users.displayName })
      .from(users)
      .where(eq(users.id, ownerId));
    if (target) {
      await createNotification({
        type: "follow_request_approved",
        recipientUserId: followerId,
        actorUserId: ownerId,
        subjectId: followId,
        payload: {
          targetUsername: target.username,
          targetDisplayName: target.displayName,
        },
      });
    }
  } catch (err) {
    logger.warn({ err, followId }, "approveFollowRequest: notification emit failed");
  }

  return true;
}

/**
 * Reject a Pending follow request. Deletes the row entirely so the
 * follower can re-request later if they want.
 */
export async function rejectFollowRequest(ownerId: string, followId: string): Promise<boolean> {
  const db = getDb();
  const result = await db
    .delete(follows)
    .where(
      and(
        eq(follows.id, followId),
        eq(follows.followedUserId, ownerId),
        isNull(follows.acceptedAt),
      ),
    )
    .returning({ id: follows.id });
  return result.length > 0;
}

export interface CollectionEntry {
  username: string;
  displayName: string | null;
  domain: string;
}

const COLLECTION_PAGE_SIZE = 50;

/**
 * Paginated list of accepted followers of `userId`. Newest acceptance first.
 * Pending requests are excluded — they live in /follows/requests.
 */
export async function listFollowers(userId: string, page: number = 1): Promise<CollectionEntry[]> {
  const db = getDb();
  const offset = (Math.max(1, page) - 1) * COLLECTION_PAGE_SIZE;
  const rows = await db
    .select({
      username: users.username,
      displayName: users.displayName,
      domain: users.domain,
    })
    .from(follows)
    .innerJoin(users, eq(follows.followerId, users.id))
    .where(and(eq(follows.followedUserId, userId), isNotNull(follows.acceptedAt)))
    .orderBy(desc(follows.acceptedAt))
    .limit(COLLECTION_PAGE_SIZE)
    .offset(offset);
  return rows;
}

/**
 * Paginated list of accepted follows from `userId`. Newest acceptance first.
 * Pending outgoing follows (against private/locked targets) are excluded.
 */
export async function listFollowing(userId: string, page: number = 1): Promise<CollectionEntry[]> {
  const db = getDb();
  const offset = (Math.max(1, page) - 1) * COLLECTION_PAGE_SIZE;
  const rows = await db
    .select({
      username: users.username,
      displayName: users.displayName,
      domain: users.domain,
    })
    .from(follows)
    .innerJoin(users, eq(follows.followedUserId, users.id))
    .where(and(eq(follows.followerId, userId), isNotNull(follows.acceptedAt)))
    .orderBy(desc(follows.acceptedAt))
    .limit(COLLECTION_PAGE_SIZE)
    .offset(offset);
  return rows;
}
