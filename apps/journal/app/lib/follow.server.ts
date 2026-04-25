import { randomUUID } from "node:crypto";
import { eq, and, count, desc } from "drizzle-orm";
import { getDb } from "./db.ts";
import { users, follows } from "@trails-cool/db/schema/journal";
import { localActorIri } from "./actor-iri.ts";

export class FollowError extends Error {
  readonly code: "self_follow" | "private_profile" | "user_not_found" | "not_found";
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
 * `targetUsername`. Auto-accepted because the target is local + public.
 * Idempotent: re-following an already-followed user returns the same state
 * without creating a duplicate row.
 */
export async function followUser(followerId: string, targetUsername: string): Promise<FollowState> {
  const target = await loadFollowableTarget(targetUsername);
  if (target.id === followerId) {
    throw new FollowError("self_follow", "Users cannot follow themselves");
  }
  if (target.profileVisibility !== "public") {
    throw new FollowError("private_profile", "This profile is not followable");
  }

  const db = getDb();
  const followedActorIri = localActorIri(target.username);
  const [existing] = await db
    .select({ id: follows.id, acceptedAt: follows.acceptedAt })
    .from(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followedActorIri, followedActorIri)));
  if (existing) {
    return { following: existing.acceptedAt !== null, pending: existing.acceptedAt === null };
  }

  await db.insert(follows).values({
    id: randomUUID(),
    followerId,
    followedActorIri,
    followedUserId: target.id,
    acceptedAt: new Date(),
  });

  return { following: true, pending: false };
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

export async function countFollowers(userId: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ n: count() })
    .from(follows)
    .where(eq(follows.followedUserId, userId));
  return row?.n ?? 0;
}

export async function countFollowing(userId: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ n: count() })
    .from(follows)
    .where(eq(follows.followerId, userId));
  return row?.n ?? 0;
}

export interface CollectionEntry {
  username: string;
  displayName: string | null;
  domain: string;
}

const COLLECTION_PAGE_SIZE = 50;

/**
 * Paginated list of users who follow `userId`. Newest acceptance first.
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
    .where(eq(follows.followedUserId, userId))
    .orderBy(desc(follows.acceptedAt))
    .limit(COLLECTION_PAGE_SIZE)
    .offset(offset);
  return rows;
}

/**
 * Paginated list of users that `userId` follows. Newest acceptance first.
 * Limited to local follows in this change (`followedUserId IS NOT NULL`);
 * federation will surface remote actors here too.
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
    .where(eq(follows.followerId, userId))
    .orderBy(desc(follows.acceptedAt))
    .limit(COLLECTION_PAGE_SIZE)
    .offset(offset);
  return rows;
}
