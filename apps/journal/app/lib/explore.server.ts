import { and, count, desc, eq, gte, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { getDb } from "./db.ts";
import { activities, follows, users } from "@trails-cool/db/schema/journal";
import { loadPersona } from "./demo-bot.server.ts";
import { localActorIri } from "./actor-iri.ts";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const ACTIVE_RECENTLY_DAYS = 30;
const ACTIVE_RECENTLY_DEFAULT_LIMIT = 5;

export interface DirectoryRow {
  id: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  latestActivityAt: Date | null;
}

export interface DirectoryListing {
  rows: DirectoryRow[];
  totalCount: number;
}

export interface ListDirectoryOptions {
  page?: number;
  perPage?: number;
}

/**
 * Clamps `?perPage=` into [1, MAX_PAGE_SIZE]. Out-of-range values
 * (NaN, negative, > MAX) snap to bounds rather than 400.
 */
function clampPerPage(raw: number | undefined): number {
  if (!raw || !Number.isFinite(raw)) return DEFAULT_PAGE_SIZE;
  return Math.max(1, Math.min(MAX_PAGE_SIZE, Math.floor(raw)));
}

function clampPage(raw: number | undefined): number {
  if (!raw || !Number.isFinite(raw)) return 1;
  return Math.max(1, Math.floor(raw));
}

function exclusionFilters() {
  // Public-only and not the demo persona. Banned/suspended users would
  // be filtered here too once such a status column exists — see design.md.
  const persona = loadPersona();
  return and(
    eq(users.profileVisibility, "public"),
    ne(users.username, persona.username),
  );
}

/**
 * Paginated directory of public local users. Order: most-recent public
 * activity DESC NULLS LAST, tiebreaker `users.id DESC` for stable
 * pagination.
 */
export async function listDirectory(opts: ListDirectoryOptions = {}): Promise<DirectoryListing> {
  const db = getDb();
  const perPage = clampPerPage(opts.perPage);
  const page = clampPage(opts.page);
  const offset = (page - 1) * perPage;

  const latestActivity = sql<Date | null>`MAX(CASE WHEN ${activities.visibility} = 'public' THEN ${activities.createdAt} ELSE NULL END)`;

  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      bio: users.bio,
      latestActivityAt: latestActivity,
    })
    .from(users)
    .leftJoin(activities, eq(activities.ownerId, users.id))
    .where(exclusionFilters())
    .groupBy(users.id)
    .orderBy(sql`${latestActivity} DESC NULLS LAST`, desc(users.id))
    .limit(perPage)
    .offset(offset);

  const [countRow] = await db
    .select({ n: count() })
    .from(users)
    .where(exclusionFilters());

  return { rows, totalCount: countRow?.n ?? 0 };
}

/**
 * Cheap count helper if a caller only wants the size — used by the
 * pagination math path that doesn't need the page rows.
 */
export async function countDirectory(): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ n: count() })
    .from(users)
    .where(exclusionFilters());
  return row?.n ?? 0;
}

/**
 * Top-N public users with at least one public activity in the last
 * 30 days. Same exclusion rules as `listDirectory`. Returns at most
 * `limit` rows; an empty array signals "no qualifying users — hide
 * the strip."
 */
export async function listActiveRecently(limit: number = ACTIVE_RECENTLY_DEFAULT_LIMIT): Promise<DirectoryRow[]> {
  const db = getDb();
  const cutoff = new Date(Date.now() - ACTIVE_RECENTLY_DAYS * 24 * 60 * 60 * 1000);

  const latestActivity = sql<Date | null>`MAX(${activities.createdAt})`;

  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      bio: users.bio,
      latestActivityAt: latestActivity,
    })
    .from(users)
    .innerJoin(activities, eq(activities.ownerId, users.id))
    .where(
      and(
        exclusionFilters(),
        eq(activities.visibility, "public"),
        gte(activities.createdAt, cutoff),
      ),
    )
    .groupBy(users.id)
    .orderBy(sql`${latestActivity} DESC`, desc(users.id))
    .limit(Math.max(1, Math.min(50, Math.floor(limit))));

  return rows;
}

/**
 * Batched accepted-follower count for a set of users. One query
 * regardless of how many users are on the page — avoids N+1 against
 * `countFollowers` per row.
 */
export async function countFollowersBatch(userIds: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (userIds.length === 0) return result;
  const db = getDb();
  const rows = await db
    .select({
      userId: follows.followedUserId,
      n: count(),
    })
    .from(follows)
    .where(
      and(
        inArray(follows.followedUserId, userIds),
        isNotNull(follows.acceptedAt),
      ),
    )
    .groupBy(follows.followedUserId);
  for (const r of rows) {
    if (r.userId) result.set(r.userId, r.n);
  }
  // Fill missing user ids with 0 so callers don't need to coalesce.
  for (const id of userIds) {
    if (!result.has(id)) result.set(id, 0);
  }
  return result;
}

/**
 * Batched follow-state lookup for a viewer against a set of target
 * users. Returns Map<targetUserId, FollowState>. Used by /explore so
 * each row's FollowButton has its `initialState` without N round-trips.
 */
export interface FollowStateRow {
  following: boolean;
  pending: boolean;
}

export async function getFollowStateBatch(
  followerId: string,
  targets: { id: string; username: string }[],
): Promise<Map<string, FollowStateRow>> {
  const result = new Map<string, FollowStateRow>();
  if (targets.length === 0) return result;
  const db = getDb();
  const iris = targets.map((t) => localActorIri(t.username));
  const irisToId = new Map(targets.map((t) => [localActorIri(t.username), t.id]));
  const rows = await db
    .select({
      iri: follows.followedActorIri,
      acceptedAt: follows.acceptedAt,
    })
    .from(follows)
    .where(
      and(
        eq(follows.followerId, followerId),
        inArray(follows.followedActorIri, iris),
      ),
    );
  for (const r of rows) {
    const id = irisToId.get(r.iri);
    if (!id) continue;
    result.set(id, { following: r.acceptedAt !== null, pending: r.acceptedAt === null });
  }
  return result;
}

/**
 * Page-size constants exposed for callers (route loader, tests).
 */
export const EXPLORE_DEFAULT_PAGE_SIZE = DEFAULT_PAGE_SIZE;
export const EXPLORE_MAX_PAGE_SIZE = MAX_PAGE_SIZE;
