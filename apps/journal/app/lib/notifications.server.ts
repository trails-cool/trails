import { randomUUID } from "node:crypto";
import { and, count, desc, eq, isNull, lt, or, sql } from "drizzle-orm";
import { getDb } from "./db.ts";
import { notifications } from "@trails-cool/db/schema/journal";
import type { NotificationType } from "@trails-cool/db/schema/journal";
import { emitTo } from "./events.server.ts";
import {
  PAYLOAD_VERSION,
  type ActivityPayloadV1,
  type ApprovalPayloadV1,
  type FollowPayloadV1,
} from "./notifications/payload.ts";

/**
 * Push the current unread count to all of `userId`'s open SSE
 * connections. Called after any state change that could affect the
 * count: createNotification (new row), markRead (one less unread),
 * markAllRead (zero unread).
 */
async function emitUnreadCount(userId: string): Promise<void> {
  const c = await countUnread(userId);
  emitTo(userId, "notifications.unread", { count: c });
}

// Discriminated union of (type, payload) so callers can't pass the
// wrong payload shape for a given event type. PAYLOAD_VERSION is set
// internally; callers don't pick a version.
type CreateInput =
  | { type: "follow_request_received"; recipientUserId: string; actorUserId: string | null; subjectId: string | null; payload: FollowPayloadV1 }
  | { type: "follow_received"; recipientUserId: string; actorUserId: string | null; subjectId: string | null; payload: FollowPayloadV1 }
  | { type: "follow_request_approved"; recipientUserId: string; actorUserId: string | null; subjectId: string | null; payload: ApprovalPayloadV1 }
  | { type: "activity_published"; recipientUserId: string; actorUserId: string | null; subjectId: string | null; payload: ActivityPayloadV1 };

/**
 * Create a notification. When `subjectId` is set, idempotent against
 * the partial unique index `(recipient_user_id, type, subject_id) WHERE
 * subject_id IS NOT NULL` so fan-out job retries can't double-insert.
 * When `subjectId` is null (1:1 follow events) idempotency is enforced
 * upstream by the follow hooks (they only emit on a *new* row), so a
 * plain insert is safe and avoids ON CONFLICT inference against a
 * partial index, which Postgres rejects.
 */
export async function createNotification(input: CreateInput): Promise<boolean> {
  const db = getDb();
  const values = {
    id: randomUUID(),
    recipientUserId: input.recipientUserId,
    type: input.type,
    actorUserId: input.actorUserId,
    subjectId: input.subjectId,
    payload: input.payload as unknown as Record<string, unknown>,
    payloadVersion: PAYLOAD_VERSION,
  };

  const result = input.subjectId
    ? await db
        .insert(notifications)
        .values(values)
        .onConflictDoNothing({
          target: [notifications.recipientUserId, notifications.type, notifications.subjectId],
          // Match the partial unique index's predicate so Postgres can
          // infer the arbiter index (`WHERE subject_id IS NOT NULL`).
          // `onConflictDoNothing` only exposes `where` (no targetWhere).
          where: sql`${notifications.subjectId} IS NOT NULL`,
        })
        .returning({ id: notifications.id })
    : await db.insert(notifications).values(values).returning({ id: notifications.id });

  if (result.length > 0) {
    // Push refreshed count to any open SSE connections for this
    // recipient. Emit happens after the row commits so the count
    // reflects reality.
    await emitUnreadCount(input.recipientUserId);
    return true;
  }
  return false;
}

export interface NotificationRow {
  id: string;
  type: NotificationType;
  actorUserId: string | null;
  subjectId: string | null;
  payload: Record<string, unknown> | null;
  payloadVersion: number;
  readAt: Date | null;
  createdAt: Date;
}

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

export interface ListOptions {
  /**
   * Opaque cursor from a previous response. When set, returns rows
   * strictly older than the cursor's `(createdAt, id)` position, so
   * pagination is stable even when two rows share `created_at`.
   */
  before?: string;
  /** Soft cap; clamped to `[1, MAX_PAGE_SIZE]`. Defaults to 50. */
  limit?: number;
}

export interface ListResult {
  rows: NotificationRow[];
  /**
   * Opaque cursor for the next page, or `null` when the caller has
   * reached the end. Pass back as `before` on the next request.
   */
  nextCursor: string | null;
}

interface CursorShape {
  ts: string;
  id: string;
}

function encodeCursor(c: CursorShape): string {
  return Buffer.from(JSON.stringify(c), "utf8").toString("base64url");
}

function decodeCursor(s: string): CursorShape | null {
  try {
    const obj = JSON.parse(Buffer.from(s, "base64url").toString("utf8")) as {
      ts?: unknown;
      id?: unknown;
    };
    if (typeof obj.ts !== "string" || typeof obj.id !== "string") return null;
    if (Number.isNaN(Date.parse(obj.ts))) return null;
    return { ts: obj.ts, id: obj.id };
  } catch {
    return null;
  }
}

/**
 * Cursor-paginated list of `userId`'s notifications, newest first.
 * Pass the previous response's `nextCursor` as `before` to fetch the
 * next page; an unknown / malformed cursor is treated as "start from
 * the top" rather than 400-ing, since the cursor is opaque to clients.
 */
export async function listForUser(
  userId: string,
  opts: ListOptions = {},
): Promise<ListResult> {
  const db = getDb();
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, opts.limit ?? DEFAULT_PAGE_SIZE));
  const cursor = opts.before ? decodeCursor(opts.before) : null;

  const baseWhere = eq(notifications.recipientUserId, userId);
  const where = cursor
    ? and(
        baseWhere,
        // (created_at, id) < (cursor.ts, cursor.id)
        // Keyset comparison broken into the two-row form so Postgres
        // uses the (recipient, created_at desc) index for the leading
        // column.
        or(
          lt(notifications.createdAt, new Date(cursor.ts)),
          and(
            eq(notifications.createdAt, new Date(cursor.ts)),
            lt(notifications.id, cursor.id),
          ),
        ),
      )
    : baseWhere;

  // Fetch limit + 1 so we can decide whether a `nextCursor` exists
  // without a separate count query.
  const rows = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      actorUserId: notifications.actorUserId,
      subjectId: notifications.subjectId,
      payload: notifications.payload,
      payloadVersion: notifications.payloadVersion,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(where)
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const trimmed = hasMore ? rows.slice(0, limit) : rows;
  const last = trimmed[trimmed.length - 1];
  const nextCursor = hasMore && last
    ? encodeCursor({ ts: last.createdAt.toISOString(), id: last.id })
    : null;

  return { rows: trimmed, nextCursor };
}

export async function countUnread(userId: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ n: count() })
    .from(notifications)
    .where(
      and(
        eq(notifications.recipientUserId, userId),
        isNull(notifications.readAt),
      ),
    );
  return row?.n ?? 0;
}

/**
 * Mark a single notification read. Owner-bound: only the recipient can
 * mark their own. Returns true on success, false if the row doesn't
 * exist or doesn't belong to the caller. Idempotent for already-read.
 */
export async function markRead(ownerId: string, id: string): Promise<boolean> {
  const db = getDb();
  const result = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.id, id),
        eq(notifications.recipientUserId, ownerId),
      ),
    )
    .returning({ id: notifications.id });
  if (result.length === 0) return false;
  await emitUnreadCount(ownerId);
  return true;
}

/**
 * Mark all of `ownerId`'s unread notifications read. Returns the
 * number of rows touched.
 */
export async function markAllRead(ownerId: string): Promise<number> {
  const db = getDb();
  const result = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.recipientUserId, ownerId),
        isNull(notifications.readAt),
      ),
    )
    .returning({ id: notifications.id });
  if (result.length > 0) await emitUnreadCount(ownerId);
  return result.length;
}

/**
 * Retention: drop read notifications older than `days`. Unread rows
 * survive indefinitely. Called by the daily pg-boss job.
 */
export async function purgeReadOlderThan(days: number): Promise<number> {
  const db = getDb();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const result = await db
    .delete(notifications)
    .where(
      and(
        sql`${notifications.readAt} IS NOT NULL`,
        lt(notifications.readAt, cutoff),
      ),
    )
    .returning({ id: notifications.id });
  return result.length;
}
